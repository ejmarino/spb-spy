import { connect, type IClientPublishOptions, type ISubscriptionMap, type MqttClient } from 'mqtt'
import { connectionUrl } from '@shared/connection'
import { createModel, nodeKey, type ConnectionModel, type DeviceState } from '@shared/model'
import { CERTIFICATES_PREFIX, parseTopic, stateTopic, topicMatches } from '@shared/topic'
import {
  SPARKPLUG_NAMESPACE,
  type ConnectionConfig,
  type ConnectionState,
  type NewEvent,
  type SpMessageType,
  type SpMetric
} from '@shared/types'
import {
  Payload,
  decodeMetricValue,
  decodeProperties,
  encodeRebirth,
  has,
  inferDatatype,
  longValue,
  typeCode,
  typeName,
  type PMetric
} from './codec'

/** Tiempo que se espera, tras publicarse como host, a que los nodos manden su BIRTH solos */
const REBIRTH_GRACE_MS = 5_000
/** Pedidos seguidos que se le hacen a un nodo que no contesta con su NBIRTH */
const REBIRTH_MAX_UNANSWERED = 3
const SEQ_MODULO = 256
const RECONNECT_MS = 5_000
const DISCONNECT_TIMEOUT_MS = 1_500
const RAW_PREVIEW_CHARS = 400
/** Tiempo que se espera el eco de un mensaje propio antes de dejar de buscarlo */
const ECHO_WINDOW_MS = 30_000

interface RebirthTarget {
  namespace: string
  group: string
  node: string
  reason: string
  since: number
}

export interface SessionHooks {
  emit(event: NewEvent): void
  status(state: ConnectionState, error?: string): void
}

function statePayload(online: boolean, timestamp: number): string {
  return JSON.stringify({ online, timestamp })
}

/**
 * Una conexion MQTT que se comporta como Host Application de Sparkplug:
 * registra su STATE (salvo que la conexion pida no anunciarse), decodifica lo
 * que llega y pide rebirth cuando le falta el BIRTH de un nodo para poder
 * resolver sus metricas.
 */
export class SparkplugSession {
  readonly model: ConnectionModel = createModel()
  active = false

  private client: MqttClient | null = null
  private linked = false
  private sessionTimestamp = 0
  private graceUntil = 0
  private graceTimer: NodeJS.Timeout | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private lastError: string | undefined
  private reportedError: string | null = null
  private readonly waitingGrace = new Map<string, RebirthTarget>()
  private readonly rebirths = new Map<string, { attempts: number; lastAt: number }>()
  /** Ultimo seq recibido de cada nodo */
  private readonly sequences = new Map<string, number>()
  /** Mensajes publicados hace poco, para reconocer su eco cuando vuelve por la suscripcion */
  private readonly sentRecently: { topic: string; payload: Buffer; at: number }[] = []

  constructor(
    readonly config: ConnectionConfig,
    private readonly hooks: SessionHooks
  ) {}

  private get stateTopic(): string {
    return stateTopic(this.config.clientId)
  }

  start(): void {
    if (this.active) return
    this.active = true
    this.reportedError = null
    this.hooks.status('connecting')
    this.open()
  }

  async stop(): Promise<void> {
    if (!this.active) return
    this.active = false
    this.clearTimers()
    const client = this.client
    const wasLinked = this.linked
    this.client = null
    this.linked = false
    if (client) {
      await new Promise<void>((resolve) => {
        if (!client.connected) {
          client.end(true, {}, () => resolve())
          return
        }
        if (!this.config.announceHost) {
          client.end(false, {}, () => resolve())
          return
        }
        // en una desconexion voluntaria el broker no publica el will: se avisa a mano
        const timeout = setTimeout(
          () => client.end(true, {}, () => resolve()),
          DISCONNECT_TIMEOUT_MS
        )
        this.publish(
          client,
          this.stateTopic,
          statePayload(false, this.sessionTimestamp),
          { qos: 1, retain: true },
          () => {
            clearTimeout(timeout)
            client.end(false, {}, () => resolve())
          }
        )
      })
    }
    if (wasLinked) this.system('info', 'Desconectado', 'down')
    this.hooks.status('disconnected')
  }

  /** Pedido manual desde la interfaz: no respeta la espera entre intentos */
  requestRebirth(group: string, node: string): void {
    const namespace = this.model.nodes.get(nodeKey(group, node))?.namespace || SPARKPLUG_NAMESPACE
    this.sendRebirth({ namespace, group, node, reason: 'pedido manual', since: Date.now() }, true)
  }

  private clearTimers(): void {
    if (this.graceTimer) clearTimeout(this.graceTimer)
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.graceTimer = null
    this.reconnectTimer = null
    this.waitingGrace.clear()
  }

  private system(level: NewEvent['level'], text: string, link?: NewEvent['link']): void {
    this.hooks.emit({
      connectionId: this.config.id,
      receivedAt: Date.now(),
      kind: 'SYSTEM',
      level,
      text,
      link
    })
  }

  private open(): void {
    const { config } = this
    // el will y el STATE online de una misma sesion llevan el mismo timestamp
    this.sessionTimestamp = Date.now()
    this.lastError = undefined
    const client = connect({
      protocol: config.tls ? 'mqtts' : 'mqtt',
      host: config.host,
      port: config.port,
      clientId: config.clientId,
      username: config.username || undefined,
      password: config.password || undefined,
      rejectUnauthorized: config.rejectUnauthorized,
      clean: true,
      keepalive: 30,
      connectTimeout: 10_000,
      // la reconexion se maneja aca para que cada intento lleve un will con timestamp nuevo
      reconnectPeriod: 0,
      will: config.announceHost
        ? {
            topic: this.stateTopic,
            payload: Buffer.from(statePayload(false, this.sessionTimestamp)),
            qos: 1,
            retain: true
          }
        : undefined
    })
    this.client = client

    // los eventos de un cliente que ya fue reemplazado o cerrado se descartan
    client.on('connect', () => {
      if (this.client === client) this.onConnect(client)
    })
    client.on('message', (topic, payload, packet) => {
      if (this.client !== client) return
      try {
        this.onMessage(topic, payload, packet.retain)
      } catch (error) {
        this.system('error', `Error procesando ${topic}: ${String(error)}`)
      }
    })
    client.on('error', (error) => {
      if (this.client === client) this.lastError = error.message
    })
    client.on('close', () => this.onClose(client))
  }

  private onConnect(client: MqttClient): void {
    const { config } = this
    const subscriptions: ISubscriptionMap = { [config.topic]: { qos: 0 } }
    if (config.announceHost && !topicMatches(config.topic, this.stateTopic)) {
      subscriptions[this.stateTopic] = { qos: 1 }
    }
    if (config.sparkplugAware) subscriptions[CERTIFICATES_PREFIX + config.topic] = { qos: 0 }

    client.subscribe(subscriptions, (error, granted) => {
      if (this.client !== client) return
      const rejected = (granted ?? []).filter((g) => g.qos === 128).map((g) => g.topic)
      if (error || rejected.length) {
        this.system(
          'error',
          `El broker rechazó la suscripción${rejected.length ? ` a ${rejected.join(', ')}` : ''}${error ? `: ${error.message}` : ''}`
        )
      }
      if (config.announceHost) {
        this.publish(client, this.stateTopic, statePayload(true, this.sessionTimestamp), {
          qos: 1,
          retain: true
        })
      }
      this.linked = true
      this.reportedError = null
      // la espera entre rebirths sigue valiendo aunque se haya reconectado
      for (const state of this.rebirths.values()) state.attempts = 0
      this.sequences.clear()
      this.graceUntil = Date.now() + REBIRTH_GRACE_MS
      this.hooks.status('connected')
      this.system(
        'info',
        `Conectado a ${connectionUrl(config)} como ${config.announceHost ? 'host' : 'cliente'} "${config.clientId}"${config.announceHost ? '' : ', sin anunciarse como host'}. Suscripto a ${Object.keys(subscriptions).join(', ')}`,
        'up'
      )
    })
  }

  private onClose(client: MqttClient): void {
    if (this.client !== client) return
    this.client = null
    client.end(true)
    if (!this.active) return

    const error = this.lastError
    if (this.linked) {
      this.linked = false
      this.clearTimers()
      this.system('warn', `Se perdió la conexión${error ? `: ${error}` : ''}`, 'down')
    } else {
      // los reintentos que fallan por el mismo motivo no se repiten en la lista de eventos
      const reason = error ?? 'el broker cerró la conexión'
      if (reason !== this.reportedError) this.system('error', `No se pudo conectar: ${reason}`)
      this.reportedError = reason
    }
    this.hooks.status('reconnecting', error)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.active) this.open()
    }, RECONNECT_MS)
  }

  /**
   * Publica un mensaje y lo deja registrado en la lista de eventos como enviado por
   * la app. Si la suscripcion cubre el topico el broker lo devuelve: ese eco se descarta.
   */
  private publish(
    client: MqttClient,
    topic: string,
    payload: Buffer | string,
    options: IClientPublishOptions,
    callback?: () => void
  ): void {
    const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
    this.sentRecently.push({ topic, payload: buffer, at: Date.now() })
    client.publish(topic, buffer, options, callback)
    this.onMessage(topic, buffer, false, true)
  }

  private isEcho(topic: string, payload: Buffer): boolean {
    const now = Date.now()
    while (this.sentRecently.length && now - this.sentRecently[0].at > ECHO_WINDOW_MS) {
      this.sentRecently.shift()
    }
    const index = this.sentRecently.findIndex(
      (sent) => sent.topic === topic && sent.payload.equals(payload)
    )
    if (index < 0) return false
    this.sentRecently.splice(index, 1)
    return true
  }

  private onMessage(topic: string, payload: Buffer, retained: boolean, sent = false): void {
    // lo que el broker tiene retenido se muestra aunque lo haya publicado esta app
    if (!sent && !retained && this.isEcho(topic, payload)) return
    const certificate = topic.startsWith(CERTIFICATES_PREFIX)
    const parsed = parseTopic(certificate ? topic.slice(CERTIFICATES_PREFIX.length) : topic)
    const base: NewEvent = {
      connectionId: this.config.id,
      receivedAt: Date.now(),
      kind: 'RAW',
      level: 'info',
      topic,
      bytes: payload.length
    }
    if (retained) base.retained = true
    if (sent) base.sent = true
    if (certificate) base.certificate = true

    if (!parsed) {
      this.hooks.emit({ ...base, level: 'warn', text: previewPayload(payload) })
      return
    }
    if (parsed.type === 'STATE') {
      this.onState({ ...base, kind: 'STATE', namespace: parsed.namespace }, parsed.hostId!, payload)
      return
    }
    const event: NewEvent = {
      ...base,
      kind: parsed.type,
      namespace: parsed.namespace,
      group: parsed.group,
      node: parsed.node,
      device: parsed.device
    }
    if (parsed.invalid) this.onInvalidTopic(event, parsed.type, parsed.invalid, payload)
    else this.onSparkplug(event, parsed.type, payload)
  }

  private onState(event: NewEvent, hostId: string, payload: Buffer): void {
    const text = payload.toString('utf8').trim()
    event.hostId = hostId
    event.self = hostId === this.config.clientId
    try {
      const state = JSON.parse(text) as { online?: unknown; timestamp?: unknown }
      if (typeof state.online !== 'boolean') throw new Error('sin campo online')
      event.online = state.online
      if (typeof state.timestamp === 'number') event.timestamp = state.timestamp
    } catch {
      // Sparkplug 2.2 publicaba el estado como texto plano
      const legacy = text.toUpperCase()
      if (legacy === 'ONLINE' || legacy === 'OFFLINE') {
        event.online = legacy === 'ONLINE'
      } else {
        event.level = 'warn'
        event.text = `STATE con formato desconocido: ${previewPayload(payload)}`
      }
    }
    this.hooks.emit(event)

    // si alguien publica el offline de este host mientras esta conectado (por ejemplo
    // el will de una sesion anterior) hay que volver a anunciarse
    const client = this.client
    if (
      this.config.announceHost &&
      event.self &&
      event.online === false &&
      !event.retained &&
      !event.sent &&
      this.linked &&
      client
    ) {
      this.publish(client, this.stateTopic, statePayload(true, this.sessionTimestamp), {
        qos: 1,
        retain: true
      })
    }
  }

  private onSparkplug(event: NewEvent, type: SpMessageType, payload: Buffer): void {
    const { group, node, device } = event as { group: string; node: string; device?: string }
    const key = nodeKey(group, node)
    const nodeState = this.model.nodes.get(key)
    const scope = device === undefined ? nodeState : nodeState?.devices.get(device)
    const isBirth = type === 'NBIRTH' || type === 'DBIRTH'
    const isData = type === 'NDATA' || type === 'DDATA'

    if (event.certificate) {
      // el broker reenvia el certificado con cada BIRTH: si ya se vio el BIRTH en vivo no aporta nada
      if (!isBirth || scope?.birthLive) return
    }

    if (!this.decode(event, payload, isBirth ? undefined : scope)) return

    if (type === 'NBIRTH' || type === 'NDEATH') {
      const bdSeq = event.metrics?.find((metric) => metric.name === 'bdSeq')?.value
      if (typeof bdSeq === 'number') event.bdSeq = bdSeq
    }
    if (
      type === 'NDEATH' &&
      event.bdSeq !== undefined &&
      nodeState?.bdSeq !== undefined &&
      nodeState.bdSeq !== event.bdSeq
    ) {
      // un NDEATH con otro bdSeq es el will de una sesion vieja del nodo
      event.level = 'warn'
      event.ignored = `bdSeq ${event.bdSeq} no coincide con el del NBIRTH (${nodeState.bdSeq})`
    }
    if (event.metrics?.some((metric) => metric.unresolved)) event.level = 'warn'
    if (!event.certificate && !event.ignored) this.checkSequence(event, key, type)

    this.hooks.emit(event)

    if (type === 'NBIRTH' && !event.certificate) {
      // el nodo contesto: vuelve a contar los intentos, pero la espera entre pedidos sigue
      const state = this.rebirths.get(key)
      if (state) state.attempts = 0
      this.waitingGrace.delete(key)
    }
    if (isData) this.checkBirth(event, scope)
    this.rebirthOnGap(event, node)
  }

  /**
   * Mensaje con forma de Sparkplug pero con un topico que no cumple la norma, como
   * "grupo/DDATA/nodo:device". No se acepta (no toca el arbol ni dispara rebirth
   * por falta de BIRTH), pero se muestra marcado y su seq cuenta para la secuencia
   * del nodo: asi el mensaje valido que sigue no parece un salto.
   */
  private onInvalidTopic(
    event: NewEvent,
    type: SpMessageType,
    problem: 'missing-device' | 'unexpected-device',
    payload: Buffer
  ): void {
    if (event.certificate) return
    const { group, node } = event as { group: string; node: string }
    let owner: string | undefined = node
    if (problem === 'missing-device') {
      owner = this.ownerOf(group, node)
      const guess = owner
        ? ` Parece el device "${node.slice(owner.length + 1)}" del nodo "${owner}" separado con ":".`
        : ''
      event.invalid = `Tópico inválido: un ${type} lleva el device id en un nivel propio, después del nodo y separado con "/".${guess}`
    } else {
      event.invalid = `Tópico inválido: un ${type} es del nodo y no lleva device id.`
    }
    event.level = 'warn'
    if (!this.decode(event, payload, undefined)) return
    if (owner !== undefined) this.checkSequence(event, nodeKey(group, owner), type)
    this.hooks.emit(event)
    if (owner !== undefined) this.rebirthOnGap(event, owner)
  }

  /** Nodo conocido del grupo cuyo id es el comienzo de "nodo:device" */
  private ownerOf(group: string, segment: string): string | undefined {
    let owner: string | undefined
    for (const node of this.model.nodes.values()) {
      if (node.group !== group || !segment.startsWith(`${node.id}:`)) continue
      if (owner === undefined || node.id.length > owner.length) owner = node.id
    }
    return owner
  }

  /** Decodifica el payload dentro del evento; si no se puede, emite el error y devuelve false */
  private decode(event: NewEvent, payload: Buffer, scope: DeviceState | undefined): boolean {
    let decoded: ReturnType<typeof Payload.decode>
    try {
      decoded = Payload.decode(payload)
    } catch (error) {
      this.hooks.emit({
        ...event,
        level: 'error',
        ignored: 'payload inválido',
        text: `No se pudo decodificar el payload Sparkplug B (${error instanceof Error ? error.message : String(error)})`
      })
      return false
    }
    if (has(decoded, 'timestamp')) event.timestamp = Number(longValue(decoded.timestamp))
    if (has(decoded, 'seq')) event.seq = Number(longValue(decoded.seq))
    event.metrics = decoded.metrics.map((metric) => toMetric(metric, scope))
    return true
  }

  /**
   * Cada mensaje de un nodo (suyo o de sus devices) lleva el seq siguiente al
   * anterior, de 0 a 255. Si no coincide se perdio algo en el medio.
   */
  private checkSequence(event: NewEvent, key: string, type: SpMessageType): void {
    // los comandos los publica un host y el NDEATH lo publica el broker: no llevan la cuenta
    if (type === 'NCMD' || type === 'DCMD') return
    if (type === 'NDEATH') {
      this.sequences.delete(key)
      return
    }
    if (event.seq === undefined) return
    const last = this.sequences.get(key)
    this.sequences.set(key, event.seq)
    // el NBIRTH reinicia la cuenta, y sin mensaje anterior no hay con que comparar
    if (type === 'NBIRTH' || last === undefined) return
    const expected = (last + 1) % SEQ_MODULO
    if (event.seq !== expected) {
      event.seqExpected = expected
      event.level = 'warn'
    }
  }

  private rebirthOnGap(event: NewEvent, node: string): void {
    if (event.seqExpected === undefined || this.config.rebirthPolicy !== 'missing-birth') return
    this.wantRebirth({
      namespace: event.namespace || SPARKPLUG_NAMESPACE,
      group: event.group!,
      node,
      reason: `salto de secuencia: se esperaba seq ${event.seqExpected} y llegó ${event.seq}`,
      since: event.receivedAt
    })
  }

  /** Decide si hay que pedir rebirth despues de un NDATA/DDATA */
  private checkBirth(event: NewEvent, scope: DeviceState | undefined): void {
    const policy = this.config.rebirthPolicy
    if (policy === 'never') return
    const unresolved = event.metrics?.some((metric) => metric.unresolved) ?? false
    const missingBirth = scope?.birthAt === undefined
    if (!unresolved && !(policy === 'missing-birth' && missingBirth)) return

    const what = event.device === undefined ? 'el nodo' : `el device ${event.device}`
    this.wantRebirth({
      namespace: event.namespace || SPARKPLUG_NAMESPACE,
      group: event.group!,
      node: event.node!,
      reason: unresolved
        ? `${event.kind} con alias sin resolver`
        : `${event.kind} sin BIRTH previo para ${what}`,
      since: event.receivedAt
    })
  }

  /** Pide el rebirth ya mismo o, si la conexion es reciente, cuando termine la espera inicial */
  private wantRebirth(target: RebirthTarget): void {
    const key = nodeKey(target.group, target.node)
    const wait = this.graceUntil - Date.now()
    if (wait <= 0) {
      this.sendRebirth(target)
      return
    }
    // recien conectados: se les da tiempo a los nodos a reaccionar al STATE del host
    if (!this.waitingGrace.has(key)) this.waitingGrace.set(key, target)
    this.graceTimer ??= setTimeout(() => {
      this.graceTimer = null
      const targets = [...this.waitingGrace.values()]
      this.waitingGrace.clear()
      for (const waiting of targets) {
        const birthAt = this.model.nodes.get(nodeKey(waiting.group, waiting.node))?.birthAt
        if (birthAt === undefined || birthAt < waiting.since) this.sendRebirth(waiting)
      }
    }, wait)
  }

  private sendRebirth(target: RebirthTarget, manual = false): void {
    const client = this.client
    if (!client || !this.linked) return
    const key = nodeKey(target.group, target.node)
    const now = Date.now()
    const state = this.rebirths.get(key) ?? { attempts: 0, lastAt: 0 }
    let attempt = ''
    if (!manual) {
      // ni mas de un pedido por nodo dentro de la espera configurada, ni insistir sin fin
      // con uno que no contesta
      const cooldown = this.config.rebirthCooldown * 1000
      if (state.attempts >= REBIRTH_MAX_UNANSWERED || now - state.lastAt < cooldown) return
      state.attempts++
      attempt = `, intento ${state.attempts}/${REBIRTH_MAX_UNANSWERED}`
    }
    state.lastAt = now
    this.rebirths.set(key, state)
    this.hooks.emit({
      connectionId: this.config.id,
      receivedAt: now,
      kind: 'SYSTEM',
      level: 'info',
      group: target.group,
      node: target.node,
      text: `Rebirth solicitado (${target.reason}${attempt})`
    })
    this.publish(
      client,
      `${target.namespace}/${target.group}/NCMD/${target.node}`,
      encodeRebirth(now),
      { qos: 0, retain: false }
    )
  }
}

function toMetric(metric: PMetric, scope: DeviceState | undefined): SpMetric {
  const alias = has(metric, 'alias') ? String(longValue(metric.alias)) : undefined
  let name = metric.name ?? ''
  const out: SpMetric = { name, type: 'Unknown', value: null }
  if (!name && alias !== undefined) {
    const known = scope?.aliases.get(alias)
    if (known !== undefined) {
      name = known
      out.viaAlias = true
    } else {
      name = `alias:${alias}`
      out.unresolved = true
    }
  }
  out.name = name || '(sin nombre)'
  if (alias !== undefined) out.alias = alias

  // en los DATA el datatype es opcional: vale el que declaro el BIRTH
  let datatype = metric.datatype ?? 0
  const known = scope?.metrics.get(out.name)
  if (!datatype) datatype = typeCode(known?.type ?? '')
  if (!datatype) datatype = inferDatatype(metric)
  out.type = typeName(datatype)
  out.value = decodeMetricValue(metric, datatype, known?.value)

  if (has(metric, 'timestamp')) out.timestamp = Number(longValue(metric.timestamp))
  if (metric.isNull) out.isNull = true
  if (metric.isHistorical) out.isHistorical = true
  if (metric.isTransient) out.isTransient = true
  const properties = decodeProperties(metric.properties)
  if (properties) out.properties = properties
  return out
}

function previewPayload(payload: Buffer): string {
  const text = payload.toString('utf8')
  // eslint-disable-next-line no-control-regex
  const printable = !/[\u0000-\u0008\u000e-\u001f�]/.test(text)
  if (printable) {
    return text.length > RAW_PREVIEW_CHARS ? `${text.slice(0, RAW_PREVIEW_CHARS)}…` : text
  }
  const hex = payload.subarray(0, 48).toString('hex')
  return `binario ${payload.length} bytes: ${hex}${payload.length > 48 ? '…' : ''}`
}
