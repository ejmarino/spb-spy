import type { DeviceState } from '@shared/model'
import type { Liveness } from '@shared/types'
import type { TreeItem } from './tree'

/** Radio del disco de un elemento y de un punto, en unidades del grafo */
export const ELEMENT_RADIUS = { connection: 9, group: 7, node: 6.5, device: 5.5 }
export const DOT_RADIUS = 2
/** Separacion de la espiral: el radio del punto i crece con raiz de i */
const DOT_SPACING = 3.4
/** Hueco que la espiral deja libre alrededor del disco del elemento */
const DOT_HOLE = 12
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

export type ElementKind = keyof typeof ELEMENT_RADIUS

/** Conexion, grupo, nodo, device o rama intermedia: lo que acomoda la simulacion */
export interface GraphElement {
  key: string
  kind: ElementKind
  label: string
  item: TreeItem
  parent: GraphElement | null
  children: GraphElement[]
  /** Nodo o device del elemento; las ramas intermedias y los grupos no tienen */
  state?: DeviceState
  /**
   * Estado con el que se dibuja: el del nodo o device, o el que resume a los que
   * cuelgan de un grupo o de una rama intermedia. Las conexiones no tienen.
   */
  status?: Liveness
  /** Metricas y UDT que se dibujan como puntos alrededor del elemento */
  dots: TreeItem[]
  /** Radio que ocupa el elemento con sus puntos */
  radius: number
  x: number
  y: number
  vx?: number
  vy?: number
  /** Lugar al que esta fijado mientras el usuario lo arrastra */
  fx?: number | null
  fy?: number | null
}

export interface Graph {
  elements: GraphElement[]
  byKey: Map<string, GraphElement>
}

/** Radio del circulo que ocupan `count` puntos alrededor de un elemento */
export function occupiedRadius(kind: ElementKind, count: number): number {
  if (!count) return ELEMENT_RADIUS[kind]
  return Math.sqrt(DOT_HOLE ** 2 + DOT_SPACING ** 2 * count) + DOT_RADIUS
}

const offsets: number[] = []

/**
 * Lugar de cada punto respecto de su elemento, en una espiral de girasol: pares
 * x, y seguidos. La tabla es una sola y crece a medida que hace falta.
 */
export function dotOffsets(count: number): number[] {
  for (let i = offsets.length / 2; i < count; i++) {
    const radius = Math.sqrt(DOT_HOLE ** 2 + DOT_SPACING ** 2 * i)
    offsets.push(radius * Math.cos(i * GOLDEN_ANGLE), radius * Math.sin(i * GOLDEN_ANGLE))
  }
  return offsets
}

/** Estado de un grupo o rama intermedia: en linea si algo de lo que cuelga lo esta */
function inheritedStatus(children: GraphElement[]): Liveness | undefined {
  const known = children.flatMap((child) => (child.status ? [child.status] : []))
  if (!known.length) return undefined
  if (known.includes('online')) return 'online'
  return known.includes('stale') ? 'stale' : 'offline'
}

function isDot(item: TreeItem): boolean {
  return item.kind === 'metric' || item.kind === 'template'
}

/**
 * Arma el grafo a partir del arbol de datos: un elemento por conexion, grupo,
 * nodo, device y rama intermedia, y un punto por metrica. Las metricas propias
 * de un nodo van alrededor del nodo, y un UDT es un solo punto.
 */
export function buildGraph(roots: TreeItem[]): Graph {
  const graph: Graph = { elements: [], byKey: new Map() }
  const add = (item: TreeItem, parent: GraphElement | null): void => {
    const kind = item.kind as ElementKind
    const element: GraphElement = {
      key: item.key,
      kind,
      label: item.label,
      item,
      parent,
      children: [],
      state: item.node ?? item.device,
      dots: [],
      radius: 0,
      x: 0,
      y: 0
    }
    graph.elements.push(element)
    graph.byKey.set(element.key, element)
    parent?.children.push(element)
    for (const child of item.children) {
      if (isDot(child)) element.dots.push(child)
      else if (child.nodeLevel) element.dots.push(...child.children.filter(isDot))
      else add(child, element)
    }
    element.radius = occupiedRadius(kind, element.dots.length)
    // el estado de un nodo o device cambia junto con la forma del arbol, asi que no envejece
    if (kind !== 'connection') {
      element.status = element.state?.status ?? inheritedStatus(element.children)
    }
  }
  for (const root of roots) add(root, null)
  return graph
}

/** Elementos desde `element` hasta su conexion, que es por donde viaja un pulso */
export function chainOf(element: GraphElement): GraphElement[] {
  const chain: GraphElement[] = []
  for (let at: GraphElement | null = element; at; at = at.parent) chain.push(at)
  return chain
}

/** Momento del ultimo DATA que se le conoce a un nodo o device; 0 si no hubo */
function lastDataAt(state: DeviceState): number {
  let at = 0
  // tras un BIRTH todas las metricas vuelven a su primer valor y no cuentan
  for (const metric of state.metrics.values()) {
    if (metric.updates > 1 && metric.updatedAt > at) at = metric.updatedAt
  }
  return at
}

/**
 * Nodos y devices que publicaron datos desde la pasada anterior. `seen` guarda
 * por elemento el ultimo DATA ya contado; un elemento que se ve por primera vez
 * queda anotado sin contar como actividad.
 */
export function detectPulses(graph: Graph, seen: Map<string, number>): GraphElement[] {
  const origins: GraphElement[] = []
  for (const element of graph.elements) {
    if (!element.state) continue
    const at = lastDataAt(element.state)
    const before = seen.get(element.key)
    if (before !== undefined && at > before) origins.push(element)
    seen.set(element.key, at)
  }
  for (const key of seen.keys()) if (!graph.byKey.has(key)) seen.delete(key)
  return origins
}

export interface Hit {
  element: GraphElement
  /** Punto apuntado; sin el, lo apuntado es el disco del elemento */
  dot?: TreeItem
}

/**
 * Lo que hay en una posicion del grafo: el disco de un elemento o, si no, el
 * punto mas cercano dentro de `reach`.
 */
export function hitTest(graph: Graph, x: number, y: number, reach: number): Hit | null {
  let best: Hit | null = null
  let bestDistance = Infinity
  for (const element of graph.elements) {
    const dx = x - element.x
    const dy = y - element.y
    const distance = Math.hypot(dx, dy)
    if (distance <= ELEMENT_RADIUS[element.kind] + reach) return { element }
    if (distance > element.radius + reach) continue
    const table = dotOffsets(element.dots.length)
    for (let i = 0; i < element.dots.length; i++) {
      const toDot = Math.hypot(dx - table[i * 2], dy - table[i * 2 + 1])
      if (toDot < bestDistance) {
        bestDistance = toDot
        best = { element, dot: element.dots[i] }
      }
    }
  }
  return bestDistance <= DOT_RADIUS + reach ? best : null
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Rectangulo que contiene a todos los elementos con sus puntos; null si no hay */
export function boundsOf(elements: GraphElement[]): Bounds | null {
  if (!elements.length) return null
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const { x, y, radius } of elements) {
    bounds.minX = Math.min(bounds.minX, x - radius)
    bounds.minY = Math.min(bounds.minY, y - radius)
    bounds.maxX = Math.max(bounds.maxX, x + radius)
    bounds.maxY = Math.max(bounds.maxY, y + radius)
  }
  return bounds
}
