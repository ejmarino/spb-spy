import { Boxes, Braces, Cable, Cpu, Router, Tag } from 'lucide-react'
import type { ConnectionConfig, ConnectionStatus, EventKind, Liveness } from '@shared/types'
import { connectionLabel } from '@shared/connection'
import { formatTimestamp } from '../format'
import type { TreeKind } from '../tree'

const KIND_ICONS = {
  connection: Cable,
  group: Boxes,
  node: Router,
  device: Cpu,
  metric: Tag,
  template: Braces
}

const KIND_TITLES: Record<TreeKind, string> = {
  connection: 'Conexión',
  group: 'Group',
  node: 'Edge node',
  device: 'Device',
  metric: 'Métrica',
  template: 'UDT (template)'
}

/** Icono propio de cada nivel del arbol: conexion, group, nodo, device, metrica y UDT */
export function KindIcon({
  kind,
  color,
  dead
}: {
  kind: TreeKind
  color?: string
  dead?: boolean
}): React.JSX.Element {
  const Icon = KIND_ICONS[kind]
  return (
    <span
      className={`kind-icon kind-${kind}${dead ? ' is-dead' : ''}`}
      style={color ? { color } : undefined}
      title={KIND_TITLES[kind]}
    >
      <Icon size={15} strokeWidth={2} />
    </span>
  )
}

const TYPE_CLASS: Record<EventKind, string> = {
  NBIRTH: 'birth',
  DBIRTH: 'birth',
  NDEATH: 'death',
  DDEATH: 'death',
  NDATA: 'data',
  DDATA: 'data',
  NCMD: 'cmd',
  DCMD: 'cmd',
  STATE: 'state',
  SYSTEM: 'system',
  RAW: 'system'
}

export function TypeBadge({ kind }: { kind: EventKind }): React.JSX.Element {
  return <span className={`type-badge type-${TYPE_CLASS[kind]}`}>{kind}</span>
}

export function ConnectionChip({
  connection
}: {
  connection: ConnectionConfig
}): React.JSX.Element {
  return (
    <span className="conn-chip" style={{ '--conn': connection.color } as React.CSSProperties}>
      <span className="conn-dot" />
      <span className="conn-name">{connectionLabel(connection)}</span>
    </span>
  )
}

const LIVENESS: Record<Liveness, { label: string; title: string }> = {
  online: { label: 'ONLINE', title: 'Publicando en vivo' },
  offline: {
    label: 'OFFLINE',
    title: 'Se recibió su DEATH: los valores son los últimos conocidos'
  },
  stale: {
    label: 'STALE',
    title: 'Sin confirmación en vivo: los valores pueden no estar actualizados'
  }
}

export function LivenessPill({
  status,
  at,
  now
}: {
  status: Liveness
  at: number
  now: number
}): React.JSX.Element {
  const { label, title } = LIVENESS[status]
  return (
    <span className={`pill pill-${status}`} title={title}>
      <span className="pill-dot" />
      {label}
      {status !== 'online' && <span className="pill-since">desde {formatTimestamp(at, now)}</span>}
    </span>
  )
}

const STATE_LABELS: Record<ConnectionStatus['state'], string> = {
  disconnected: 'Desconectada',
  connecting: 'Conectando…',
  connected: 'Conectada',
  reconnecting: 'Reintentando…'
}

export function ConnectionStatePill({
  status
}: {
  status: ConnectionStatus | undefined
}): React.JSX.Element {
  const state = status?.state ?? 'disconnected'
  return (
    <span className={`pill pill-conn-${state}`} title={status?.error}>
      <span className="pill-dot" />
      {STATE_LABELS[state]}
    </span>
  )
}
