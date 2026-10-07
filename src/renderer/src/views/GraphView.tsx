import { useEffect, useRef, useState } from 'react'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type ForceLink
} from 'd3-force'
import { Maximize } from 'lucide-react'
import type { Liveness } from '@shared/types'
import { KindIcon, LivenessPill } from '../components/badges'
import { engUnit, formatTimestamp, formatValue, plural } from '../format'
import {
  boundsOf,
  buildGraph,
  chainOf,
  detectPulses,
  dotOffsets,
  DOT_RADIUS,
  ELEMENT_RADIUS,
  hitTest,
  type Graph,
  type GraphElement,
  type Hit
} from '../graph'
import { FLASH_MS, store } from '../store'
import { buildTree, latestUpdateAt, leafOf } from '../tree'

/*
 * Aspecto y movimiento del grafo. Las distancias estan en unidades del grafo
 * (un pixel con zoom 1) salvo las que dicen "pantalla".
 */
/** Espacio libre entre un elemento y su padre, ademas de lo que ocupan sus puntos */
const LINK_GAP = 26
const LINK_STRENGTH = 0.7
/** Cuanto se afloja el enlace con cada hermano mas: 0 no afloja, 1 reparte la fuerza */
const LINK_CROWDING = 0.5
/** Repulsion entre elementos: una base mas lo que suma cada uno por lo que ocupa */
const REPULSION = -70
const REPULSION_PER_RADIUS = -3
/** Mas lejos que esto los elementos no se empujan: los grafos sueltos no se alejan */
const REPULSION_REACH = 500
/** Separacion entre lo que ocupan dos elementos; deja lugar para el nombre */
const COLLIDE_GAP = 14
/** Fuerza que evita que los grafos de las conexiones se alejen sin limite */
const CENTERING = 0.03
/** Radio del circulo en el que nacen las conexiones cuando hay mas de una */
const ROOT_SPREAD = 400
/** Temperatura de la simulacion al acomodar cambios en un grafo ya armado: tope y piso */
const REHEAT = 0.2
const REHEAT_MIN = 0.04
/** Pasadas que se hacen de una vez al armar el grafo, para no mostrarlo desarmado */
const SETTLE_TICKS = 300
/**
 * Cuanto se enfria la simulacion por pasada. Mas lento que lo habitual: si se
 * enfria antes de llegar al equilibrio, cada cambio posterior sigue acomodando
 * todo el grafo.
 */
const COOLING = 0.012
const MIN_ZOOM = 0.08
const MAX_ZOOM = 6
const ZOOM_SPEED = 0.0015
/** Margen de pantalla que deja el encuadre, y zoom maximo al que llega */
const FIT_PADDING = 48
const FIT_MAX_ZOOM = 1.6
const FIT_EASING = 0.18
/** Zoom por debajo del cual se dejan de dibujar los nombres de cada nivel */
const LABEL_MIN_ZOOM = { connection: 0, group: 0.28, node: 0.28, device: 0.55 }
/** Con los puntos mas chicos que esto en pantalla se dibuja un disco en su lugar */
const DOT_MIN_SCREEN = 0.7
/** Distancia de pantalla a la que el mouse alcanza a un punto o a un elemento */
const HOVER_REACH = 4
/** Lo que tarda un pulso en recorrer cada tramo hasta el elemento de arriba */
const PULSE_SEGMENT_MS = 320
const PULSE_RADIUS = 2.6
/** Parte del tramo que ocupa la estela del pulso */
const PULSE_TAIL = 0.35
/** Temperatura a la que se mantiene la simulacion mientras se arrastra un elemento */
const DRAG_HEAT = 0.3
/** Resorte con el que cada punto persigue su lugar, y cuanto pierde por cuadro */
const DOT_SPRING = 0.2
const DOT_DAMPING = 0.72
/** Cuanto mas blando es el resorte del punto mas alejado respecto del mas cercano */
const DOT_SPRING_SLACK = 0.6
/** Por debajo de esto un punto se da por llegado a su lugar */
const DOT_REST = 0.02
/** Halo de reposo de un punto: radio, opacidad y tamaño de pantalla minimo para dibujarlo */
const HALO_RADIUS = DOT_RADIUS * 4.5
const HALO_ALPHA = 0.55
const HALO_MIN_SCREEN = 1.1
/** Con mas puntos que estos a la vista, cada elemento lleva un solo halo para todos los suyos */
const HALO_BUDGET = 3000
/** Ese halo compartido, en veces el radio que ocupan los puntos, y su opacidad */
const CLOUD_HALO = 1.3
const CLOUD_HALO_ALPHA = 0.5
/** Halo de un punto recien actualizado y de un pulso */
const GLOW_RADIUS = DOT_RADIUS * 4.5
/** Mas claro que el halo de reposo, para que lo recien actualizado se distinga */
const GLOW_COLOR = '#bfe0ff'
const PULSE_GLOW_RADIUS = PULSE_RADIUS * 4.5
/** Halo de un elemento, en veces su radio */
const ELEMENT_HALO = 3.6
const ELEMENT_HALO_ALPHA = 0.7
/** Lado, en pixeles, de la imagen de degradado que se usa como halo */
const SPRITE_SIZE = 64
const OFFLINE_COLOR = '#4a5262'
/** Nucleo y halo de un punto de metrica: mas luminosos que el gris de su icono */
const METRIC_CORE = '#c9d2e6'
const METRIC_HALO = '#5f8cff'
const STALE_ALPHA = 0.45

interface Link {
  source: GraphElement
  target: GraphElement
}

interface Pulse {
  chain: GraphElement[]
  startedAt: number
}

/** Puntos de un elemento con su inercia: x, y, velocidad x, velocidad y de cada uno */
interface DotCloud {
  data: Float32Array
  /** Los puntos ya estan en su lugar para el elemento en esta posicion */
  resting: boolean
  restX: number
  restY: number
}

/** Lo que hay bajo el mouse y donde, en pixeles del area del grafo */
interface Tip {
  hit: Hit
  x: number
  y: number
  /** Tamaño del area, para que el tooltip no se salga */
  width: number
  height: number
}

interface Palette {
  background: string
  link: string
  text: string
  muted: string
  accent: string
  font: string
  kind: Record<'group' | 'node' | 'device' | 'metric' | 'template', string>
}

function readPalette(element: Element): Palette {
  const style = getComputedStyle(element)
  const read = (name: string): string => style.getPropertyValue(name).trim()
  return {
    background: read('--bg'),
    link: read('--border-strong'),
    text: read('--text-2'),
    muted: read('--muted'),
    accent: read('--accent'),
    font: style.fontFamily,
    kind: {
      group: read('--kind-group'),
      node: read('--kind-node'),
      device: read('--kind-device'),
      metric: read('--kind-metric'),
      template: read('--kind-template')
    }
  }
}

/**
 * Direccion en la que nace un elemento nuevo: el medio del hueco mas grande que
 * dejan, alrededor de su padre, los vecinos que ya tienen lugar.
 */
function freeAngle(parent: GraphElement, placed: Set<GraphElement>): number {
  const angles = [parent.parent, ...parent.children]
    .filter((neighbor) => neighbor !== null && placed.has(neighbor))
    .map((neighbor) => Math.atan2(neighbor!.y - parent.y, neighbor!.x - parent.x))
    .sort((a, b) => a - b)
  if (!angles.length) return 0
  let start = angles[angles.length - 1]
  let gap = angles[0] + 2 * Math.PI - start
  for (let i = 1; i < angles.length; i++) {
    if (angles[i] - angles[i - 1] > gap) {
      start = angles[i - 1]
      gap = angles[i] - angles[i - 1]
    }
  }
  return start + gap / 2
}

const sprites = new Map<string, HTMLCanvasElement>()

/** Imagen de un halo del color pedido: lleno en el centro y transparente en el borde */
function haloSprite(color: string): HTMLCanvasElement {
  let sprite = sprites.get(color)
  if (!sprite) {
    sprite = document.createElement('canvas')
    sprite.width = sprite.height = SPRITE_SIZE
    const context = sprite.getContext('2d')!
    const half = SPRITE_SIZE / 2
    const gradient = context.createRadialGradient(half, half, 0, half, half, half)
    // el navegador deja el color como #rrggbb, y de ahi salen las paradas con alfa
    context.fillStyle = color
    const solid = String(context.fillStyle)
    // cae mas rapido que una recta: nucleo marcado y borde suave
    for (const [stop, alpha] of [
      [0, 1],
      [0.25, 0.55],
      [0.5, 0.22],
      [0.75, 0.06],
      [1, 0]
    ]) {
      const opacity = Math.round(alpha * 255)
      gradient.addColorStop(stop, solid + opacity.toString(16).padStart(2, '0'))
    }
    context.fillStyle = gradient
    context.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
    sprites.set(color, sprite)
  }
  return sprite
}

function alphaOf(status: Liveness | undefined): number {
  return status === 'stale' ? STALE_ALPHA : 1
}

/**
 * El grafo fuera de React: guarda las posiciones, corre la simulacion y dibuja
 * el lienzo. Vive mientras vive la vista, asi al volver a ella el grafo esta
 * donde quedo. El bucle de dibujo corre solo mientras hay algo que animar.
 */
class GraphEngine {
  private graph: Graph = { elements: [], byKey: new Map() }
  private readonly links = forceLink<GraphElement, Link>()
    .distance((link) => link.source.radius + link.target.radius + LINK_GAP)
    // cuantos mas hermanos, menos tira cada enlace: si no, se amontonan sobre el padre
    .strength((link) => LINK_STRENGTH / link.target.children.length ** LINK_CROWDING) as ForceLink<
    GraphElement,
    Link
  >
  private readonly simulation = forceSimulation<GraphElement>()
    .force('link', this.links)
    .force(
      'charge',
      forceManyBody<GraphElement>()
        .strength((element) => REPULSION + REPULSION_PER_RADIUS * element.radius)
        .distanceMax(REPULSION_REACH)
    )
    .force(
      'collide',
      forceCollide<GraphElement>((element) => element.radius + COLLIDE_GAP).iterations(3)
    )
    .force('x', forceX<GraphElement>(0).strength(CENTERING))
    .force('y', forceY<GraphElement>(0).strength(CENTERING))
    .alphaDecay(COOLING)
    .stop()

  private readonly camera = { x: 0, y: 0, k: 1 }
  /** El encuadre sigue al grafo hasta que el usuario mueve o acerca el lienzo */
  private following = true
  /** Todavia no se mostro nada: el primer encuadre va directo, sin animacion */
  private unframed = true
  private built: { connections: unknown; structure: number; separator: string | null } | null = null
  /** Ultimo DATA ya contado de cada nodo y device, para detectar los pulsos */
  private readonly seen = new Map<string, number>()
  private pulses: Pulse[] = []
  private readonly lastPulse = new Map<string, number>()
  /** Donde esta la cabeza de cada pulso en el cuadro que se esta dibujando */
  private pulseHeads: { x: number; y: number }[] = []

  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null
  private palette: Palette | null = null
  private width = 0
  private height = 0
  private frame: number | null = null
  /** Hasta cuando seguir dibujando por un brillo que puede estar apagandose */
  private awakeUntil = 0
  private drag: { x: number; y: number } | null = null
  /** Elemento que el usuario lleva con el mouse, y a que distancia de su centro lo agarro */
  private grab: { key: string; dx: number; dy: number } | null = null
  /** Posicion y velocidad de los puntos de cada elemento */
  private readonly clouds = new Map<string, DotCloud>()
  private pointer: { x: number; y: number } | null = null
  private onHover: (tip: Tip | null) => void = () => {}

  /** Empieza a dibujar en el lienzo; devuelve como soltarlo */
  attach(canvas: HTMLCanvasElement, onHover: (tip: Tip | null) => void): () => void {
    this.canvas = canvas
    this.context = canvas.getContext('2d')
    this.palette = readPalette(canvas)
    this.onHover = onHover
    // lo que paso con la vista cerrada no se anima al volver
    this.seen.clear()
    this.pulses = []

    const resize = new ResizeObserver(() => this.resize())
    resize.observe(canvas)
    this.resize()

    const wheel = (event: WheelEvent): void => {
      event.preventDefault()
      const { x, y } = this.locate(event)
      this.zoomAt(x, y, Math.exp(-event.deltaY * ZOOM_SPEED))
    }
    const down = (event: PointerEvent): void => {
      canvas.setPointerCapture(event.pointerId)
      const at = this.locate(event)
      this.drag = at
      this.hover(null)
      // sobre un elemento o uno de sus puntos se lo agarra; sobre el fondo se mueve el lienzo
      const world = this.toGraph(at)
      const hit = hitTest(this.graph, world.x, world.y, HOVER_REACH / this.camera.k)
      if (!hit) return
      const { element } = hit
      this.grab = { key: element.key, dx: element.x - world.x, dy: element.y - world.y }
      this.hold(at)
      // enfriada no avanza: hay que calentarla ademas de pedirle que se mantenga asi
      this.simulation.alphaTarget(DRAG_HEAT).alpha(Math.max(this.simulation.alpha(), DRAG_HEAT))
      this.wake()
    }
    const move = (event: PointerEvent): void => {
      const at = this.locate(event)
      if (!this.drag) return this.hover(at)
      if (this.grab) {
        this.hold(at)
      } else {
        this.camera.x += at.x - this.drag.x
        this.camera.y += at.y - this.drag.y
      }
      this.drag = at
      this.following = false
      this.wake()
    }
    const up = (event: PointerEvent): void => {
      this.release()
      this.hover(this.locate(event))
    }
    const leave = (): void => this.hover(null)
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointerleave', leave)

    const unsubscribe = store.subscribe(() => this.sync())
    this.sync()

    return () => {
      unsubscribe()
      resize.disconnect()
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointerleave', leave)
      if (this.frame !== null) cancelAnimationFrame(this.frame)
      this.frame = null
      this.canvas = null
      this.context = null
      this.release()
      this.pointer = null
    }
  }

  /** Lleva el elemento agarrado a donde esta el puntero */
  private hold(at: { x: number; y: number }): void {
    const element = this.grab && this.graph.byKey.get(this.grab.key)
    if (!this.grab || !element) return
    const world = this.toGraph(at)
    element.fx = world.x + this.grab.dx
    element.fy = world.y + this.grab.dy
  }

  /** Suelta lo que se estaba arrastrando: el elemento vuelve a quedar sujeto a las fuerzas */
  private release(): void {
    const element = this.grab && this.graph.byKey.get(this.grab.key)
    if (element) element.fx = element.fy = null
    if (this.grab) this.simulation.alphaTarget(0)
    this.grab = null
    this.drag = null
  }

  private toGraph(at: { x: number; y: number }): { x: number; y: number } {
    const { x, y, k } = this.camera
    return { x: (at.x - x) / k, y: (at.y - y) / k }
  }

  /** Vuelve a encuadrar todo el grafo y a seguirlo */
  fit(): void {
    this.following = true
    this.wake()
  }

  /** Pone el grafo al dia con el store: forma, pulsos y lo que hay bajo el mouse */
  private sync(): void {
    const { connections, structure, settings } = store
    const separator = settings.splitLevels ? settings.levelSeparator : null
    const built = this.built
    if (
      !built ||
      built.connections !== connections ||
      built.structure !== structure ||
      built.separator !== separator
    ) {
      this.built = { connections, structure, separator }
      this.rebuild(buildGraph(buildTree(connections, (id) => store.model(id), separator)))
    }

    const now = performance.now()
    for (const origin of detectPulses(this.graph, this.seen)) {
      // con mensajes muy seguidos alcanza un pulso por tramo: la rama queda encendida
      if (now - (this.lastPulse.get(origin.key) ?? -Infinity) < PULSE_SEGMENT_MS) continue
      this.lastPulse.set(origin.key, now)
      if (origin.parent) this.pulses.push({ chain: chainOf(origin), startedAt: now })
    }
    this.awakeUntil = now + FLASH_MS + 200
    this.wake()
  }

  /**
   * Reemplaza el grafo conservando el lugar de lo que ya estaba. Lo nuevo nace
   * junto a su padre y la simulacion se recalienta apenas lo necesario.
   */
  private rebuild(next: Graph): void {
    const previous = this.graph.byKey
    const roots = next.elements.filter((element) => !element.parent)
    /** Elementos que nacen o cambian de tamaño; con los que se van, lo que hay que acomodar */
    let moved = 0
    const gone = previous.size > 0 && [...previous.keys()].some((key) => !next.byKey.has(key))
    /** Elementos que ya tienen lugar: los que estaban y los que van naciendo */
    const placed = new Set<GraphElement>()
    for (const element of next.elements) {
      const old = previous.get(element.key)
      if (!old) continue
      element.x = old.x
      element.y = old.y
      element.vx = old.vx
      element.vy = old.vy
      element.fx = old.fx
      element.fy = old.fy
      if (old.radius !== element.radius) moved++
      placed.add(element)
    }
    for (const element of next.elements) {
      if (placed.has(element)) continue
      moved++
      const { parent } = element
      if (parent) {
        const angle = freeAngle(parent, placed)
        // por fuera de los hermanos que ya estan: nacer entre ellos los desacomoda
        let distance = parent.radius + element.radius + LINK_GAP
        for (const sibling of parent.children) {
          if (!placed.has(sibling)) continue
          const reach = Math.hypot(sibling.x - parent.x, sibling.y - parent.y)
          distance = Math.max(distance, reach + (sibling.radius + element.radius) / 2)
        }
        element.x = parent.x + distance * Math.cos(angle)
        element.y = parent.y + distance * Math.sin(angle)
      } else if (roots.length > 1) {
        const turn = (roots.indexOf(element) / roots.length) * 2 * Math.PI
        element.x = ROOT_SPREAD * Math.cos(turn)
        element.y = ROOT_SPREAD * Math.sin(turn)
      }
      placed.add(element)
    }
    const first = !this.graph.elements.some((element) => element.parent)
    this.graph = next

    this.simulation.nodes(next.elements)
    this.links.links(
      next.elements.flatMap((element) =>
        element.parent ? [{ source: element, target: element.parent }] : []
      )
    )
    if (first) {
      this.simulation.alpha(1).tick(SETTLE_TICKS)
    } else if (moved || gone) {
      // cuanto menos cambia, menos se calienta: un device nuevo no sacude un grafo grande
      const heat = Math.min(REHEAT, REHEAT_MIN + (gone ? REHEAT : moved / next.elements.length))
      this.simulation.alpha(Math.max(this.simulation.alpha(), heat))
    }

    for (const key of this.clouds.keys()) if (!next.byKey.has(key)) this.clouds.delete(key)
    for (const element of next.elements) this.fitCloud(element)

    // los pulsos en vuelo siguen sobre los elementos nuevos
    this.pulses = this.pulses.flatMap((pulse) => {
      const chain = pulse.chain.map((element) => next.byKey.get(element.key))
      return chain.every((element) => element !== undefined)
        ? [{ ...pulse, chain: chain as GraphElement[] }]
        : []
    })
    for (const key of this.lastPulse.keys()) if (!next.byKey.has(key)) this.lastPulse.delete(key)
    this.hover(this.pointer)
  }

  /**
   * Ajusta la nube de puntos de un elemento a la cantidad que tiene ahora. Los
   * que ya estaban conservan su lugar; los nuevos nacen en el centro y se abren.
   */
  private fitCloud(element: GraphElement): void {
    const size = element.dots.length * 4
    const cloud = this.clouds.get(element.key)
    if (cloud?.data.length === size) return
    if (!size) {
      this.clouds.delete(element.key)
      return
    }
    const data = new Float32Array(size)
    const kept = cloud ? Math.min(cloud.data.length, size) : 0
    if (cloud) data.set(cloud.data.subarray(0, kept))
    for (let i = kept; i < size; i += 4) {
      data[i] = element.x
      data[i + 1] = element.y
    }
    this.clouds.set(element.key, { data, resting: false, restX: 0, restY: 0 })
  }

  /**
   * Avanza un cuadro la inercia de los puntos: cada uno persigue su lugar en la
   * espiral con un resorte amortiguado. Devuelve si alguno sigue en movimiento.
   */
  private stepDots(): boolean {
    let moving = false
    for (const element of this.graph.elements) {
      const cloud = this.clouds.get(element.key)
      if (!cloud) continue
      if (cloud.resting && cloud.restX === element.x && cloud.restY === element.y) continue
      const { data } = cloud
      const count = data.length / 4
      const table = dotOffsets(count)
      let settled = true
      for (let i = 0; i < count; i++) {
        const at = i * 4
        // los de afuera tienen el resorte mas blando: la nube se estira al moverla
        const spring = DOT_SPRING * (1 - (DOT_SPRING_SLACK * i) / count)
        const toX = element.x + table[i * 2] - data[at]
        const toY = element.y + table[i * 2 + 1] - data[at + 1]
        data[at + 2] = (data[at + 2] + toX * spring) * DOT_DAMPING
        data[at + 3] = (data[at + 3] + toY * spring) * DOT_DAMPING
        data[at] += data[at + 2]
        data[at + 1] += data[at + 3]
        if (
          settled &&
          Math.abs(toX) + Math.abs(toY) + Math.abs(data[at + 2]) + Math.abs(data[at + 3]) > DOT_REST
        ) {
          settled = false
        }
      }
      if (settled) {
        // se los deja justo en su lugar para que coincidan con lo que encuentra el mouse
        for (let i = 0; i < count; i++) {
          data[i * 4] = element.x + table[i * 2]
          data[i * 4 + 1] = element.y + table[i * 2 + 1]
          data[i * 4 + 2] = data[i * 4 + 3] = 0
        }
      } else {
        moving = true
      }
      cloud.resting = settled
      cloud.restX = element.x
      cloud.restY = element.y
    }
    return moving
  }

  private locate(event: MouseEvent): { x: number; y: number } {
    const box = this.canvas!.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }

  private zoomAt(x: number, y: number, factor: number): void {
    const { camera } = this
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.k * factor))
    // lo que estaba bajo el puntero sigue bajo el puntero
    camera.x = x - ((x - camera.x) / camera.k) * k
    camera.y = y - ((y - camera.y) / camera.k) * k
    camera.k = k
    this.following = false
    this.hover(this.pointer)
    this.wake()
  }

  /** Avisa lo que hay bajo el mouse: un punto, o un nodo o device */
  private hover(at: { x: number; y: number } | null): void {
    this.pointer = at
    if (!at || this.drag) return this.onHover(null)
    const world = this.toGraph(at)
    const hit = hitTest(this.graph, world.x, world.y, HOVER_REACH / this.camera.k)
    this.onHover(
      hit && (hit.dot || hit.element.state)
        ? { hit, x: at.x, y: at.y, width: this.width, height: this.height }
        : null
    )
  }

  private resize(): void {
    const { canvas } = this
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    this.width = canvas.clientWidth
    this.height = canvas.clientHeight
    canvas.width = Math.round(this.width * ratio)
    canvas.height = Math.round(this.height * ratio)
    this.wake()
  }

  private wake(): void {
    if (this.frame === null && this.canvas) {
      this.frame = requestAnimationFrame(() => this.tick())
    }
  }

  private tick(): void {
    this.frame = null
    let moving = false
    if (this.simulation.alpha() > this.simulation.alphaMin()) {
      this.simulation.tick()
      moving = true
      // el punto apuntado se mueve con su elemento
      if (this.pointer && !this.drag) this.hover(this.pointer)
    }
    if (this.stepDots()) moving = true
    if (this.following && this.follow()) moving = true
    this.draw()
    if (moving || this.drag || this.pulses.length || performance.now() < this.awakeUntil) {
      this.wake()
    }
  }

  /** Acerca la camara al encuadre de todo el grafo; devuelve si todavia se mueve */
  private follow(): boolean {
    const bounds = boundsOf(this.graph.elements)
    if (!bounds || !this.width || !this.height) return false
    const { camera } = this
    const k = Math.min(
      FIT_MAX_ZOOM,
      (this.width - FIT_PADDING * 2) / (bounds.maxX - bounds.minX),
      (this.height - FIT_PADDING * 2) / (bounds.maxY - bounds.minY)
    )
    const x = this.width / 2 - ((bounds.minX + bounds.maxX) / 2) * k
    const y = this.height / 2 - ((bounds.minY + bounds.maxY) / 2) * k
    const settled =
      Math.abs(x - camera.x) < 0.5 &&
      Math.abs(y - camera.y) < 0.5 &&
      Math.abs(k / camera.k - 1) < 0.002
    const easing = this.unframed || settled ? 1 : FIT_EASING
    this.unframed = false
    camera.x += (x - camera.x) * easing
    camera.y += (y - camera.y) * easing
    camera.k += (k - camera.k) * easing
    return !settled
  }

  private draw(): void {
    const { context, palette, camera, width, height } = this
    if (!context || !palette) return
    const ratio = window.devicePixelRatio || 1
    const { x, y, k } = camera
    const { elements } = this.graph
    const now = Date.now()

    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)
    context.setTransform(ratio * k, 0, 0, ratio * k, ratio * x, ratio * y)
    context.globalAlpha = 1

    // parte del grafo que entra en el lienzo
    const left = -x / k
    const top = -y / k
    const right = (width - x) / k
    const bottom = (height - y) / k
    const inView = (element: GraphElement): boolean =>
      element.x + element.radius >= left &&
      element.x - element.radius <= right &&
      element.y + element.radius >= top &&
      element.y - element.radius <= bottom

    context.strokeStyle = palette.link
    context.lineWidth = Math.max(1, 1 / k)
    context.beginPath()
    for (const element of elements) {
      if (!element.parent) continue
      context.moveTo(element.x, element.y)
      context.lineTo(element.parent.x, element.parent.y)
    }
    context.stroke()

    const visible = elements.filter(inView)
    const far = DOT_RADIUS * k < DOT_MIN_SCREEN
    const shown = far ? 0 : visible.reduce((total, element) => total + element.dots.length, 0)
    const halos = DOT_RADIUS * k >= HALO_MIN_SCREEN && shown <= HALO_BUDGET
    const metricHalo = haloSprite(METRIC_HALO)
    const sprite = (image: HTMLCanvasElement, atX: number, atY: number, size: number): void =>
      context.drawImage(image, atX - size, atY - size, size * 2, size * 2)

    /*
     * El dibujo va por pasadas y no elemento por elemento: cambiar de modo de
     * mezcla a cada rato es lo mas caro. Primero toda la luz, despues lo opaco.
     */
    context.globalCompositeOperation = 'lighter'
    for (const element of visible) {
      const cloud = this.clouds.get(element.key)
      if (!cloud || element.status === 'offline') continue
      const alpha = alphaOf(element.status)
      if (far) {
        // de lejos los puntos no se distinguen: queda la mancha de luz que ocupan
        const age = now - (this.seen.get(element.key) ?? 0)
        const glow = age < FLASH_MS ? 1 - age / FLASH_MS : 0
        context.globalAlpha = alpha * (0.4 + 0.6 * glow)
        sprite(
          glow ? haloSprite(palette.accent) : metricHalo,
          element.x,
          element.y,
          element.radius * CLOUD_HALO
        )
      } else if (!halos) {
        // demasiados puntos para un halo cada uno: la luz va en una sola mancha por elemento
        context.globalAlpha = alpha * CLOUD_HALO_ALPHA
        sprite(metricHalo, element.x, element.y, element.radius * CLOUD_HALO)
      } else {
        const { data } = cloud
        const templateHalo = haloSprite(palette.kind.template)
        context.globalAlpha = alpha * HALO_ALPHA
        for (let i = 0; i < element.dots.length; i++) {
          const image = element.dots[i].kind === 'metric' ? metricHalo : templateHalo
          sprite(image, data[i * 4], data[i * 4 + 1], HALO_RADIUS)
        }
      }
    }

    context.globalCompositeOperation = 'source-over'
    /** x, y e intensidad de cada punto encendido, para dibujarlos encima del resto */
    const glowing: number[] = []
    for (const element of visible) {
      const cloud = this.clouds.get(element.key)
      if (!cloud) continue
      const offline = element.status === 'offline'
      context.globalAlpha = alphaOf(element.status)
      if (far) {
        if (!offline) continue
        context.globalAlpha = 0.5
        sprite(haloSprite(OFFLINE_COLOR), element.x, element.y, element.radius * CLOUD_HALO)
        continue
      }
      const { data } = cloud
      const count = element.dots.length
      for (const kind of ['metric', 'template'] as const) {
        context.fillStyle = offline
          ? OFFLINE_COLOR
          : kind === 'metric'
            ? METRIC_CORE
            : palette.kind.template
        context.beginPath()
        for (let i = 0; i < count; i++) {
          const dot = element.dots[i]
          if (dot.kind !== kind) continue
          const dotX = data[i * 4]
          const dotY = data[i * 4 + 1]
          context.moveTo(dotX + DOT_RADIUS, dotY)
          context.arc(dotX, dotY, DOT_RADIUS, 0, Math.PI * 2)
          const age = now - latestUpdateAt(dot)
          if (age < FLASH_MS) glowing.push(dotX, dotY, 1 - age / FLASH_MS)
        }
        context.fill()
      }
    }

    context.globalCompositeOperation = 'lighter'
    const fresh = haloSprite(GLOW_COLOR)
    for (let i = 0; i < glowing.length; i += 3) {
      context.globalAlpha = glowing[i + 2]
      sprite(fresh, glowing[i], glowing[i + 1], GLOW_RADIUS)
    }
    this.drawPulseLight(context, palette)
    const colors = visible.map((element) =>
      element.status === 'offline'
        ? OFFLINE_COLOR
        : element.kind === 'connection'
          ? element.item.connection.color
          : palette.kind[element.kind]
    )
    visible.forEach((element, index) => {
      if (element.status === 'offline') return
      context.globalAlpha = alphaOf(element.status) * ELEMENT_HALO_ALPHA
      sprite(
        haloSprite(colors[index]),
        element.x,
        element.y,
        ELEMENT_RADIUS[element.kind] * ELEMENT_HALO
      )
    })

    context.globalCompositeOperation = 'source-over'
    context.fillStyle = '#fff'
    for (let i = 0; i < glowing.length; i += 3) {
      context.globalAlpha = glowing[i + 2]
      context.beginPath()
      context.arc(glowing[i], glowing[i + 1], DOT_RADIUS, 0, Math.PI * 2)
      context.fill()
    }
    context.globalAlpha = 1
    context.beginPath()
    for (const { x: headX, y: headY } of this.pulseHeads) {
      context.moveTo(headX + PULSE_RADIUS, headY)
      context.arc(headX, headY, PULSE_RADIUS, 0, Math.PI * 2)
    }
    context.fill()
    visible.forEach((element, index) => {
      context.globalAlpha = alphaOf(element.status)
      context.beginPath()
      context.arc(element.x, element.y, ELEMENT_RADIUS[element.kind], 0, Math.PI * 2)
      if (element.state || element.kind === 'connection' || element.kind === 'group') {
        context.fillStyle = colors[index]
        context.fill()
      } else {
        // rama intermedia: no es un nodo ni un device, queda hueca
        context.fillStyle = palette.background
        context.fill()
        context.strokeStyle = colors[index]
        context.lineWidth = 1.5
        context.stroke()
      }
    })

    // los nombres van en tamaño de pantalla, sin escalar con el zoom
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.textAlign = 'center'
    context.textBaseline = 'top'
    context.lineJoin = 'round'
    context.lineWidth = 3
    context.strokeStyle = palette.background
    for (const element of visible) {
      if (k < LABEL_MIN_ZOOM[element.kind]) continue
      const root = element.kind === 'connection'
      const offline = element.status === 'offline'
      context.globalAlpha = alphaOf(element.status)
      context.font = `${root ? '600 12.5px' : '11.5px'} ${palette.font}`
      context.fillStyle = offline ? palette.muted : root ? '#fff' : palette.text
      const labelX = element.x * k + x
      // debajo de todo lo que ocupa el elemento, para no tapar sus puntos
      const labelY = (element.y + element.radius) * k + y + 4
      context.strokeText(element.label, labelX, labelY)
      context.fillText(element.label, labelX, labelY)
    }
    context.globalAlpha = 1
  }

  /**
   * La luz de los pulsos: cada uno avanza un tramo por vez hacia la conexion,
   * con una estela. Deja anotado donde va cada cabeza para dibujarla despues.
   */
  private drawPulseLight(context: CanvasRenderingContext2D, palette: Palette): void {
    const now = performance.now()
    this.pulses = this.pulses.filter(
      (pulse) => (now - pulse.startedAt) / PULSE_SEGMENT_MS < pulse.chain.length - 1
    )
    this.pulseHeads = []
    const glow = haloSprite(palette.accent)
    context.lineCap = 'round'
    context.strokeStyle = palette.accent
    context.lineWidth = PULSE_RADIUS
    for (const { chain, startedAt } of this.pulses) {
      const progress = (now - startedAt) / PULSE_SEGMENT_MS
      const segment = Math.floor(progress)
      const from = chain[segment]
      const to = chain[segment + 1]
      const head = progress - segment
      const tail = Math.max(0, head - PULSE_TAIL)
      const x = from.x + (to.x - from.x) * head
      const y = from.y + (to.y - from.y) * head
      context.globalAlpha = 0.6
      context.beginPath()
      context.moveTo(from.x + (to.x - from.x) * tail, from.y + (to.y - from.y) * tail)
      context.lineTo(x, y)
      context.stroke()
      context.globalAlpha = 1
      context.drawImage(
        glow,
        x - PULSE_GLOW_RADIUS,
        y - PULSE_GLOW_RADIUS,
        PULSE_GLOW_RADIUS * 2,
        PULSE_GLOW_RADIUS * 2
      )
      this.pulseHeads.push({ x, y })
    }
    context.lineCap = 'butt'
  }
}

const KIND_NAMES = { connection: 'Conexión', group: 'Group', node: 'Edge node', device: 'Device' }

/** Lo que se sabe del punto, nodo o device que esta bajo el mouse */
function GraphTip({ tip }: { tip: Tip }): React.JSX.Element | null {
  const { dot, element } = tip.hit
  const { width, height } = tip
  const now = store.now
  let body: React.JSX.Element | null = null

  if (dot) {
    const leaf = leafOf(dot)
    if (!leaf) return null
    const unit = engUnit(leaf.properties)
    body = (
      <>
        <div className="graph-tip-title">
          <KindIcon kind={dot.kind} />
          {dot.label}
        </div>
        <div className="graph-tip-value">
          <span className="value">{formatValue(leaf.type, leaf.value)}</span>
          {unit ? <span className="unit">{unit}</span> : null}
        </div>
        <div className="graph-tip-facts">
          <span>{leaf.type}</span>
          <span>{formatTimestamp(leaf.timestamp ?? leaf.updatedAt, now)}</span>
        </div>
      </>
    )
  } else if (element.state) {
    const { state } = element
    body = (
      <>
        <div className="graph-tip-title">
          <KindIcon kind={element.kind} />
          {state.id}
        </div>
        <div className="graph-tip-facts">
          <LivenessPill status={state.status} at={state.statusAt} now={now} />
          <span>
            {KIND_NAMES[element.kind]} · {plural(state.metrics.size, 'métrica')}
          </span>
        </div>
      </>
    )
  }
  if (!body) return null

  // cerca del borde derecho o de abajo el tooltip se abre hacia el otro lado
  const flipX = tip.x > width - 300
  const flipY = tip.y > height - 110
  return (
    <div
      className="graph-tip"
      style={{
        left: flipX ? undefined : tip.x + 14,
        right: flipX ? width - tip.x + 14 : undefined,
        top: flipY ? undefined : tip.y + 14,
        bottom: flipY ? height - tip.y + 14 : undefined
      }}
    >
      {body}
    </div>
  )
}

export function GraphView({ active }: { active: boolean }): React.JSX.Element | null {
  const [engine] = useState(() => new GraphEngine())
  const canvas = useRef<HTMLCanvasElement>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const [connections, setConnections] = useState(store.connections.length)

  useEffect(() => {
    if (!active || !canvas.current) return
    const detach = engine.attach(canvas.current, setTip)
    // la vista no se redibuja con cada lote: solo sigue lo que muestra fuera del lienzo
    const refresh = (): void => {
      setConnections(store.connections.length)
      setTip((current) => current && { ...current })
    }
    const unsubscribe = store.subscribe(refresh)
    refresh()
    return () => {
      unsubscribe()
      detach()
      setTip(null)
    }
  }, [active, engine])

  if (!active) return null

  return (
    <section className="view view-graph">
      <header className="view-header">
        <div>
          <h1>Visualización de datos</h1>
          <p>
            La jerarquía de conexiones, grupos, nodos y devices con sus métricas como puntos. Lo que
            se actualiza brilla, y cada mensaje de datos viaja hasta su conexión.
          </p>
        </div>
        <div className="header-actions">
          <button className="button" onClick={() => engine.fit()} disabled={!connections}>
            <Maximize size={14} /> Encuadrar
          </button>
        </div>
      </header>

      <div className="graph-stage">
        <canvas ref={canvas} />
        {connections ? null : (
          <div className="empty">
            <h2>No hay conexiones</h2>
            <p>Agregá un broker desde Conexiones para empezar.</p>
          </div>
        )}
        <div className="legend graph-legend">
          <span>
            <KindIcon kind="group" /> Group
          </span>
          <span>
            <KindIcon kind="node" /> Nodo
          </span>
          <span>
            <KindIcon kind="device" /> Device
          </span>
          <span title="Tramo del nombre que no es un nodo ni un device, como «sala» en sala:tanque1">
            <span className="graph-legend-ring" /> Rama intermedia
          </span>
          <span>
            <KindIcon kind="metric" /> Métrica
          </span>
          <span>
            <KindIcon kind="template" /> UDT
          </span>
        </div>
        {tip ? <GraphTip tip={tip} /> : null}
      </div>
    </section>
  )
}
