import { isReadOnly, isWritableType } from '@shared/command'
import type { ConnectionModel, DeviceState, MetricState, NodeState } from '@shared/model'
import { asTemplate, type TemplateValue } from '@shared/template'
import type { ConnectionConfig, SpProperty, SpValue } from '@shared/types'

/** template: una metrica cuyo valor es un UDT, con sus miembros como filas hijas */
export type TreeKind = 'connection' | 'group' | 'node' | 'device' | 'metric' | 'template'

export interface TreeItem {
  key: string
  kind: TreeKind
  label: string
  depth: number
  children: TreeItem[]
  connection: ConnectionConfig
  /** Solo en el ultimo tramo del nombre de un nodo */
  node?: NodeState
  /** Solo en el ultimo tramo del nombre de un device */
  device?: DeviceState
  /** La fila "-" que agrupa las metricas propias del nodo */
  nodeLevel?: boolean
  /** Nodo o device del que depende que el dato este vivo */
  owner?: DeviceState
  /** En las filas de metrica, el nodo al que hay que mandarle los comandos */
  edgeNode?: NodeState
  /** Metrica de la fila; en las filas de un UDT, la metrica que lo contiene */
  metric?: MetricState
  /** Camino de nombres hasta el miembro, dentro del UDT de la metrica */
  path?: string[]
  /** El final del camino es un parametro del UDT y no un miembro */
  parameter?: boolean
  /** Totales de todo lo que cuelga de este elemento */
  nodes: number
  devices: number
  metrics: number
  /** Nodos y devices offline por debajo de este elemento, sin contarlo a el */
  offlineBelow: number
}

/** Separador de niveles dentro de un group, node o device id */
const SEGMENT_SEPARATOR = ':'
const KEY_SEPARATOR = '\u0001'
const sorter = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function segments(id: string): string[] {
  const parts = id.split(SEGMENT_SEPARATOR).filter((part) => part !== '')
  return parts.length ? parts : [id]
}

function createItem(
  parent: TreeItem | null,
  connection: ConnectionConfig,
  kind: TreeKind,
  label: string,
  id = label
): TreeItem {
  return {
    key: parent ? `${parent.key}${KEY_SEPARATOR}${kind}:${id}` : `connection:${id}`,
    kind,
    label,
    depth: parent ? parent.depth + 1 : 0,
    children: [],
    connection,
    nodes: 0,
    devices: 0,
    metrics: 0,
    offlineBelow: 0
  }
}

class Builder {
  private readonly index = new Map<string, TreeItem>()

  child(parent: TreeItem, kind: TreeKind, label: string, id = label): TreeItem {
    const item = createItem(parent, parent.connection, kind, label, id)
    const existing = this.index.get(item.key)
    if (existing) return existing
    this.index.set(item.key, item)
    parent.children.push(item)
    return item
  }

  /** Baja por los tramos de un id tipo "sala:tanque1" creando una rama por tramo */
  path(parent: TreeItem, kind: TreeKind, id: string): TreeItem {
    let item = parent
    for (const segment of segments(id)) item = this.child(item, kind, segment)
    return item
  }

  metrics(parent: TreeItem, owner: DeviceState, edgeNode: NodeState): void {
    for (const metric of owner.metrics.values()) {
      const item = this.child(parent, 'metric', metric.name)
      item.metric = metric
      item.owner = owner
      item.edgeNode = edgeNode
      const template = asTemplate(metric.type, metric.value)
      if (template) this.template(item, template, [])
    }
  }

  /**
   * Abre un UDT en filas: una por parametro y una por miembro. Las filas guardan
   * el camino y no el valor, porque cada actualizacion reemplaza el objeto del UDT.
   */
  private template(item: TreeItem, template: TemplateValue, path: string[]): void {
    item.kind = 'template'
    const row = (name: string, id: string): TreeItem => {
      const child = this.child(item, 'metric', name, id)
      child.metric = item.metric
      child.owner = item.owner
      child.edgeNode = item.edgeNode
      child.path = [...path, name]
      return child
    }
    for (const parameter of template.parameters ?? []) {
      row(parameter.name, `\u0003${parameter.name}`).parameter = true
    }
    for (const member of template.metrics) {
      const child = row(member.name, member.name)
      const nested = asTemplate(member.type, member.value)
      if (nested) this.template(child, nested, child.path!)
    }
  }
}

/** Lo que muestra una fila de metrica, sea una metrica o un miembro de UDT */
export interface Leaf {
  type: string
  value: SpValue
  alias?: string
  timestamp?: number
  updatedAt: number
  updates: number
  isNull?: boolean
  unresolved?: boolean
  properties?: Record<string, SpProperty>
}

/** Valor actual de la fila: los miembros de UDT se buscan por su camino en cada pasada */
export function leafOf(item: TreeItem): Leaf | undefined {
  const { metric, path } = item
  if (!metric || !path) return metric
  let template = asTemplate(metric.type, metric.value)
  for (let i = 0; template && i < path.length; i++) {
    const last = i === path.length - 1
    if (last && item.parameter) {
      const parameter = template.parameters?.find((known) => known.name === path[i])
      return parameter && { ...parameter, updatedAt: metric.updatedAt, updates: 1 }
    }
    const member = template.metrics.find((known) => known.name === path[i])
    if (!member) return undefined
    if (last) {
      return {
        ...member,
        timestamp: member.timestamp ?? metric.timestamp,
        updatedAt: member.updatedAt ?? metric.updatedAt,
        updates: member.updates ?? 1
      }
    }
    template = asTemplate(member.type, member.value)
  }
  return undefined
}

/**
 * La fila es una metrica, o un miembro de un UDT, a la que se le puede mandar un
 * comando para cambiarle el valor: tiene un tipo que se puede escribir y el nodo
 * no la declara de solo lectura.
 */
export function isWritable(item: TreeItem, leaf: Leaf | undefined): boolean {
  const { metric, edgeNode } = item
  if (item.kind !== 'metric' || item.parameter || !metric || !edgeNode || !leaf) return false
  if (metric.unresolved || !isWritableType(leaf.type)) return false
  if (isReadOnly(leaf.properties) || isReadOnly(metric.properties)) return false
  // el bdSeq es de la sesion del nodo, y una definicion de UDT no tiene valores que cambiar
  if (item.owner === edgeNode && metric.name === 'bdSeq') return false
  return !asTemplate(metric.type, metric.value)?.isDefinition
}

function isMetricRow(item: TreeItem): boolean {
  return item.kind === 'metric' || item.kind === 'template'
}

function order(item: TreeItem): number {
  if (item.nodeLevel) return 0
  return isMetricRow(item) ? 2 : 1
}

function finish(item: TreeItem): void {
  // las metricas quedan en el orden del BIRTH; el resto, alfabetico
  item.children.sort((a, b) => {
    const byOrder = order(a) - order(b)
    if (byOrder !== 0) return byOrder
    return isMetricRow(a) ? 0 : sorter.compare(a.label, b.label)
  })
  for (const child of item.children) {
    finish(child)
    item.nodes += child.nodes + (child.node ? 1 : 0)
    item.devices += child.devices + (child.device ? 1 : 0)
    // un UDT cuenta como una metrica, no una por miembro
    item.metrics += child.metrics + (child.metric && !child.path ? 1 : 0)
    const state = child.node ?? child.device
    item.offlineBelow += child.offlineBelow + (state?.status === 'offline' ? 1 : 0)
  }
}

export function buildTree(
  connections: ConnectionConfig[],
  model: (id: string) => ConnectionModel | undefined
): TreeItem[] {
  return connections.map((connection) => {
    const root = createItem(null, connection, 'connection', connection.name, connection.id)
    const builder = new Builder()
    for (const node of model(connection.id)?.nodes.values() ?? []) {
      const group = builder.path(root, 'group', node.group)
      const nodeItem = builder.path(group, 'node', node.id)
      nodeItem.node = node

      const own = builder.child(nodeItem, 'device', '-', '\u0002node')
      own.nodeLevel = true
      own.owner = node
      builder.metrics(own, node, node)

      for (const device of node.devices.values()) {
        const deviceItem = builder.path(nodeItem, 'device', device.id)
        deviceItem.device = device
        deviceItem.owner = device
        builder.metrics(deviceItem, device, node)
      }
    }
    finish(root)
    return root
  })
}

/**
 * Por defecto todo abierto, salvo las listas muy largas de metricas y las
 * definiciones de UDT (lo que interesa ver son las instancias, que traen los valores)
 */
const AUTO_COLLAPSE_METRICS = 60

export function defaultOpen(item: TreeItem): boolean {
  if (item.kind === 'template') {
    const template = leafOf(item)
    if (template && asTemplate(template.type, template.value)?.isDefinition) return false
  }
  const direct = item.children.reduce((count, child) => count + (child.metric ? 1 : 0), 0)
  return direct <= AUTO_COLLAPSE_METRICS
}

/** Filas visibles en orden, segun lo que esta abierto y el texto buscado */
export function flattenTree(
  roots: TreeItem[],
  isOpen: (item: TreeItem) => boolean,
  query: string
): TreeItem[] {
  const rows: TreeItem[] = []
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

  if (!terms.length) {
    const walk = (item: TreeItem): void => {
      rows.push(item)
      if (isOpen(item)) item.children.forEach(walk)
    }
    roots.forEach(walk)
    return rows
  }

  // con busqueda: queda lo que coincide, sus ancestros y todo lo que cuelga de una coincidencia
  const matches = (item: TreeItem): boolean => {
    const label = item.label.toLowerCase()
    return terms.every((term) => label.includes(term))
  }
  const walk = (item: TreeItem, inherited: boolean): boolean => {
    const self = inherited || matches(item)
    const start = rows.length
    rows.push(item)
    let below = false
    for (const child of item.children) below = walk(child, self) || below
    if (!self && !below) rows.length = start
    return self || below
  }
  for (const root of roots) walk(root, false)
  return rows
}
