import type {
  Liveness,
  SerializedDevice,
  SerializedMetric,
  SerializedNode,
  SpEvent,
  SpMetric,
  SpProperty,
  SpValue
} from './types'
import { mergeTemplate, stampTemplate } from './template'

export interface MetricState {
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

export interface DeviceState {
  id: string
  status: Liveness
  statusAt: number
  birthAt?: number
  /** El ultimo BIRTH llego en vivo (no desde un certificado retenido) */
  birthLive?: boolean
  metrics: Map<string, MetricState>
  aliases: Map<string, string>
}

export interface NodeState extends DeviceState {
  namespace: string
  group: string
  bdSeq?: number
  devices: Map<string, DeviceState>
}

export interface ConnectionModel {
  nodes: Map<string, NodeState>
  /** Sube cada vez que cambia la forma del arbol o el estado de un nodo/device */
  structure: number
}

export function createModel(): ConnectionModel {
  return { nodes: new Map(), structure: 0 }
}

export function nodeKey(group: string, node: string): string {
  return `${group}/${node}`
}

function ensureNode(model: ConnectionModel, ev: SpEvent): NodeState {
  const key = nodeKey(ev.group!, ev.node!)
  let node = model.nodes.get(key)
  if (!node) {
    node = {
      namespace: ev.namespace ?? '',
      group: ev.group!,
      id: ev.node!,
      status: 'stale',
      statusAt: ev.receivedAt,
      metrics: new Map(),
      aliases: new Map(),
      devices: new Map()
    }
    model.nodes.set(key, node)
    model.structure++
  }
  return node
}

function ensureDevice(model: ConnectionModel, node: NodeState, ev: SpEvent): DeviceState {
  let device = node.devices.get(ev.device!)
  if (!device) {
    device = {
      id: ev.device!,
      status: 'stale',
      statusAt: ev.receivedAt,
      metrics: new Map(),
      aliases: new Map()
    }
    node.devices.set(device.id, device)
    model.structure++
  }
  return device
}

function setStatus(
  model: ConnectionModel,
  target: DeviceState,
  status: Liveness,
  at: number
): void {
  if (target.status === status) return
  target.status = status
  target.statusAt = at
  model.structure++
}

function toState(metric: SpMetric, ev: SpEvent): MetricState {
  const timestamp = metric.timestamp ?? ev.timestamp
  return {
    name: metric.name,
    alias: metric.alias,
    type: metric.type,
    value: metric.type === 'Template' ? stampTemplate(metric.value, timestamp) : metric.value,
    timestamp,
    updatedAt: ev.receivedAt,
    updates: 1,
    isNull: metric.isNull,
    properties: metric.properties,
    unresolved: metric.unresolved
  }
}

/** Un BIRTH redefine por completo las metricas y los alias de su nodo o device */
function applyBirth(model: ConnectionModel, target: DeviceState, ev: SpEvent): void {
  target.metrics = new Map()
  target.aliases = new Map()
  for (const metric of ev.metrics ?? []) {
    target.metrics.set(metric.name, toState(metric, ev))
    if (metric.alias !== undefined) target.aliases.set(metric.alias, metric.name)
  }
  target.birthAt = ev.receivedAt
  target.birthLive = !ev.certificate
  model.structure++
}

function applyData(model: ConnectionModel, target: DeviceState, ev: SpEvent): void {
  for (const metric of ev.metrics ?? []) {
    // los valores historicos no representan el estado actual
    if (metric.isHistorical) continue
    const current = target.metrics.get(metric.name)
    if (!current) {
      target.metrics.set(metric.name, toState(metric, ev))
      model.structure++
      continue
    }
    if (current.type === 'Template' && metric.type === 'Template') {
      const merged = mergeTemplate(current.value, metric.value, {
        at: ev.receivedAt,
        timestamp: metric.timestamp ?? ev.timestamp
      })
      current.value = merged.value
      if (merged.grew) model.structure++
    } else {
      // pasar a ser un UDT (o dejar de serlo) cambia las filas que ocupa en el arbol
      if ((current.type === 'Template') !== (metric.type === 'Template')) model.structure++
      current.value = metric.value
    }
    current.isNull = metric.isNull
    current.timestamp = metric.timestamp ?? ev.timestamp
    current.updatedAt = ev.receivedAt
    current.updates++
    if (metric.type !== 'Unknown') current.type = metric.type
    if (metric.properties) current.properties = metric.properties
  }
}

/**
 * Aplica un evento al modelo de datos de su conexion. Lo usan el proceso
 * principal (que necesita el modelo para resolver alias) y el renderer (que
 * mantiene una copia para dibujar el arbol), asi ambos llegan al mismo estado.
 */
export function applyEvent(model: ConnectionModel, ev: SpEvent): void {
  if (ev.kind === 'SYSTEM') {
    if (ev.link === 'reset') {
      model.nodes.clear()
      model.structure++
    } else if (ev.link === 'down') {
      // sin enlace con el broker no se sabe que paso con los nodos
      for (const node of model.nodes.values()) {
        if (node.status === 'online') setStatus(model, node, 'stale', ev.receivedAt)
        for (const device of node.devices.values()) {
          if (device.status === 'online') setStatus(model, device, 'stale', ev.receivedAt)
        }
      }
    }
    return
  }
  if (ev.ignored || ev.invalid || !ev.group || !ev.node) return
  const live = !ev.certificate
  const at = ev.receivedAt

  switch (ev.kind) {
    case 'NBIRTH': {
      const node = ensureNode(model, ev)
      applyBirth(model, node, ev)
      node.bdSeq = ev.bdSeq
      if (ev.namespace !== undefined) node.namespace = ev.namespace
      if (live) {
        setStatus(model, node, 'online', at)
        // tras un NBIRTH cada device tiene que volver a publicar su DBIRTH
        for (const device of node.devices.values()) {
          if (device.status === 'online') setStatus(model, device, 'stale', at)
        }
      }
      break
    }
    case 'DBIRTH': {
      if (!ev.device) return
      const node = ensureNode(model, ev)
      const device = ensureDevice(model, node, ev)
      applyBirth(model, device, ev)
      if (live) {
        setStatus(model, node, 'online', at)
        setStatus(model, device, 'online', at)
      }
      break
    }
    case 'NDEATH': {
      const node = ensureNode(model, ev)
      setStatus(model, node, 'offline', at)
      for (const device of node.devices.values()) setStatus(model, device, 'offline', at)
      break
    }
    case 'DDEATH': {
      if (!ev.device) return
      const node = ensureNode(model, ev)
      setStatus(model, ensureDevice(model, node, ev), 'offline', at)
      break
    }
    case 'NDATA': {
      const node = ensureNode(model, ev)
      setStatus(model, node, 'online', at)
      applyData(model, node, ev)
      break
    }
    case 'DDATA': {
      if (!ev.device) return
      const node = ensureNode(model, ev)
      const device = ensureDevice(model, node, ev)
      setStatus(model, node, 'online', at)
      setStatus(model, device, 'online', at)
      applyData(model, device, ev)
      break
    }
  }
}

function serializeMetrics(metrics: Map<string, MetricState>): SerializedMetric[] {
  return [...metrics.values()].map((m) => ({ ...m }))
}

export function serializeModel(model: ConnectionModel): SerializedNode[] {
  return [...model.nodes.values()].map((node) => ({
    namespace: node.namespace,
    group: node.group,
    id: node.id,
    status: node.status,
    statusAt: node.statusAt,
    birthAt: node.birthAt,
    birthLive: node.birthLive,
    bdSeq: node.bdSeq,
    metrics: serializeMetrics(node.metrics),
    devices: [...node.devices.values()].map((device): SerializedDevice => ({
      id: device.id,
      status: device.status,
      statusAt: device.statusAt,
      birthAt: device.birthAt,
      birthLive: device.birthLive,
      metrics: serializeMetrics(device.metrics)
    }))
  }))
}

function restoreMetrics(list: SerializedMetric[]): Pick<DeviceState, 'metrics' | 'aliases'> {
  const metrics = new Map<string, MetricState>()
  const aliases = new Map<string, string>()
  for (const metric of list) {
    metrics.set(metric.name, { ...metric })
    if (metric.alias !== undefined && !metric.unresolved) aliases.set(metric.alias, metric.name)
  }
  return { metrics, aliases }
}

export function deserializeModel(nodes: SerializedNode[]): ConnectionModel {
  const model = createModel()
  for (const node of nodes) {
    const devices = new Map<string, DeviceState>()
    for (const device of node.devices) {
      devices.set(device.id, { ...device, ...restoreMetrics(device.metrics) })
    }
    model.nodes.set(nodeKey(node.group, node.id), {
      ...node,
      ...restoreMetrics(node.metrics),
      devices
    })
  }
  model.structure = 1
  return model
}
