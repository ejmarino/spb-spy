export const SPARKPLUG_NAMESPACE = 'spBv1.0'
export const DEFAULT_TOPIC = `${SPARKPLUG_NAMESPACE}/#`

/**
 * Cuando pedir un rebirth (NCMD Node Control/Rebirth) a un nodo:
 * - never: nunca
 * - alias: solo si llega un DATA con alias que no se pueden resolver
 * - missing-birth: ademas, cuando llega DATA de un nodo o device sin BIRTH conocido
 *   o cuando el seq de un nodo no es consecutivo (se perdieron mensajes)
 */
export type RebirthPolicy = 'never' | 'alias' | 'missing-birth'

export interface ConnectionConfig {
  id: string
  name: string
  color: string
  host: string
  port: number
  tls: boolean
  rejectUnauthorized: boolean
  sparkplugAware: boolean
  /** Client ID de MQTT; tambien se usa como Host Application ID de Sparkplug */
  clientId: string
  topic: string
  username: string
  password: string
  rebirthPolicy: RebirthPolicy
  /** Segundos minimos entre dos pedidos de rebirth al mismo nodo */
  rebirthCooldown: number
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface ConnectionStatus {
  id: string
  state: ConnectionState
  since: number
  error?: string
}

export type SpMessageType =
  'NBIRTH' | 'NDEATH' | 'DBIRTH' | 'DDEATH' | 'NDATA' | 'DDATA' | 'NCMD' | 'DCMD' | 'STATE'

/** SYSTEM: eventos de la propia app (conexion, rebirth). RAW: mensaje que no es Sparkplug */
export type EventKind = SpMessageType | 'SYSTEM' | 'RAW'

export type SpValue = string | number | boolean | null | SpValue[] | { [key: string]: SpValue }

export interface SpProperty {
  type: string
  value: SpValue
}

export interface SpMetric {
  name: string
  alias?: string
  type: string
  value: SpValue
  timestamp?: number
  isNull?: boolean
  isHistorical?: boolean
  isTransient?: boolean
  properties?: Record<string, SpProperty>
  /** El nombre no venia en el mensaje: se resolvio con el alias del BIRTH */
  viaAlias?: boolean
  /** Vino solo el alias y todavia no hay BIRTH para resolverlo */
  unresolved?: boolean
}

export interface SpEvent {
  id: number
  connectionId: string
  receivedAt: number
  kind: EventKind
  level: 'info' | 'warn' | 'error'
  topic?: string
  namespace?: string
  group?: string
  node?: string
  device?: string
  /** Timestamp del payload Sparkplug */
  timestamp?: number
  seq?: number
  /** Solo si hubo un salto: el seq que tenia que llegar segun el mensaje anterior del nodo */
  seqExpected?: number
  bdSeq?: number
  metrics?: SpMetric[]
  /** STATE: host application que publica y su estado */
  hostId?: string
  online?: boolean
  /** STATE del host de esta misma app */
  self?: boolean
  /** Mensaje publicado por la app (no recibido del broker) */
  sent?: boolean
  text?: string
  bytes?: number
  retained?: boolean
  /** Llego por $sparkplug/certificates (broker Sparkplug Aware) */
  certificate?: boolean
  /** Motivo por el que el mensaje no se aplica al modelo de datos */
  ignored?: string
  /** El mensaje no cumple con Sparkplug (por ejemplo el topico): se muestra pero no se acepta */
  invalid?: string
  /** SYSTEM: cambio en el enlace con el broker o reinicio de los datos */
  link?: 'up' | 'down' | 'reset'
}

export type NewEvent = Omit<SpEvent, 'id'>

export interface SerializedMetric {
  name: string
  alias?: string
  type: string
  value: SpValue
  timestamp?: number
  updatedAt: number
  updates: number
  isNull?: boolean
  properties?: Record<string, SpProperty>
  unresolved?: boolean
}

export type Liveness = 'online' | 'offline' | 'stale'

export interface SerializedDevice {
  id: string
  status: Liveness
  statusAt: number
  birthAt?: number
  birthLive?: boolean
  metrics: SerializedMetric[]
}

export interface SerializedNode extends Omit<SerializedDevice, 'id'> {
  namespace: string
  group: string
  id: string
  bdSeq?: number
  devices: SerializedDevice[]
}

export interface Snapshot {
  connections: ConnectionConfig[]
  statuses: ConnectionStatus[]
  models: { connectionId: string; nodes: SerializedNode[] }[]
  events: SpEvent[]
  lastEventId: number
}

export interface SpbApi {
  listConnections(): Promise<ConnectionConfig[]>
  saveConnection(config: ConnectionConfig): Promise<ConnectionConfig[]>
  deleteConnection(id: string): Promise<ConnectionConfig[]>
  connect(id: string): Promise<void>
  disconnect(id: string): Promise<void>
  requestRebirth(connectionId: string, group: string, node: string): Promise<void>
  clearEvents(): Promise<void>
  getSnapshot(): Promise<Snapshot>
  onBatch(callback: (events: SpEvent[]) => void): () => void
  onStatus(callback: (status: ConnectionStatus) => void): () => void
}
