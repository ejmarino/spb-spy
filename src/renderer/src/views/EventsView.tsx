import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Eraser,
  Pause,
  Search,
  Send,
  TriangleAlert,
  X
} from 'lucide-react'
import { connectionLabel } from '@shared/connection'
import type { ConnectionConfig, EventKind, SpEvent, SpMetric } from '@shared/types'
import { ConnectionChip, TypeBadge } from '../components/badges'
import { ConnectionFilter } from '../components/ConnectionFilter'
import { VirtualList } from '../components/VirtualList'
import { engUnit, formatDateTime, formatJson, formatTime, formatValue } from '../format'
import { store, useStoreVersion } from '../store'

const ROW_HEIGHT = 26
/** Los mensajes con mas metricas que esto se muestran resumidos en una fila que se puede abrir */
const COLLAPSE_OVER = 5
const DETAIL_METRICS = 300

/** Pildoras de filtro: cada evento cae en una sola, asi se pueden combinar sin sorpresas */
const FILTER_GROUPS: { id: string; label: string; title: string }[] = [
  { id: 'birth', label: 'BIRTH', title: 'NBIRTH y DBIRTH' },
  { id: 'death', label: 'DEATH', title: 'NDEATH y DDEATH' },
  { id: 'data', label: 'DATA', title: 'NDATA y DDATA' },
  { id: 'cmd', label: 'CMD', title: 'NCMD y DCMD publicados por otros hosts' },
  { id: 'state', label: 'STATE', title: 'STATE de los hosts, tal como los entrega el broker' },
  { id: 'system', label: 'SISTEMA', title: 'Avisos de la app y mensajes que no son Sparkplug' },
  {
    id: 'sent',
    label: 'ENVIADOS',
    title: 'Lo que publica esta app: su STATE, los NCMD de rebirth y los comandos de escritura'
  }
]

const KIND_GROUP: Record<EventKind, string> = {
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

function groupOf(event: SpEvent): string {
  return event.sent ? 'sent' : KIND_GROUP[event.kind]
}

interface Row {
  key: string
  event: SpEvent
  metric?: SpMetric
  /** Fila resumen de un mensaje con muchas metricas */
  summary?: boolean
  open?: boolean
  /** Metrica mostrada debajo de su fila resumen */
  child?: boolean
}

interface Selection {
  event: SpEvent
  metric?: SpMetric
}

function toggled<T>(set: Set<T>, values: T[]): Set<T> {
  const next = new Set(set)
  const allHidden = values.every((value) => next.has(value))
  for (const value of values) {
    if (allHidden) next.delete(value)
    else next.add(value)
  }
  return next
}

function buildRows(
  events: SpEvent[],
  names: Map<string, string>,
  hiddenConnections: Set<string>,
  hiddenGroups: Set<string>,
  query: string,
  expanded: Set<number>
): Row[] {
  const rows: Row[] = []
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (text: string): boolean => terms.every((term) => text.includes(term))

  for (const event of events) {
    if (hiddenConnections.has(event.connectionId) || hiddenGroups.has(groupOf(event))) continue
    const metrics = event.metrics ?? []

    if (terms.length) {
      // al buscar se compara metrica por metrica, tambien dentro de los mensajes resumidos
      const head = [
        names.get(event.connectionId),
        event.kind,
        event.group,
        event.node,
        event.device,
        event.hostId,
        event.text,
        event.topic,
        // para poder buscarlos escribiendo "inválido", "enviado" o "salto"
        event.invalid ? `inválido invalido ${event.invalid}` : '',
        event.sent ? 'enviado publicado' : '',
        event.seqExpected !== undefined ? 'salto de secuencia' : ''
      ]
        .join(' ')
        .toLowerCase()
      if (!metrics.length) {
        if (matches(head)) rows.push({ key: `${event.id}`, event })
        continue
      }
      metrics.forEach((metric, i) => {
        const text = `${head} ${metric.name} ${formatValue(metric.type, metric.value)} ${metric.type}`
        if (matches(text.toLowerCase())) rows.push({ key: `${event.id}:${i}`, event, metric })
      })
      continue
    }

    if (!metrics.length) {
      rows.push({ key: `${event.id}`, event })
    } else if (metrics.length > COLLAPSE_OVER) {
      const open = expanded.has(event.id)
      rows.push({ key: `${event.id}`, event, summary: true, open })
      if (open) {
        metrics.forEach((metric, i) =>
          rows.push({ key: `${event.id}:${i}`, event, metric, child: true })
        )
      }
    } else {
      metrics.forEach((metric, i) => rows.push({ key: `${event.id}:${i}`, event, metric }))
    }
  }
  return rows
}

function MetricName({ metric }: { metric: SpMetric }): React.JSX.Element {
  if (metric.unresolved) {
    return (
      <span
        className="unresolved"
        title="Llegó solo el alias y todavía no hay BIRTH para resolverlo"
      >
        <TriangleAlert size={12} /> alias {metric.alias} sin resolver
      </span>
    )
  }
  return (
    <>
      {metric.name}
      {metric.viaAlias ? (
        <span className="mini-tag" title="Nombre resuelto con el alias declarado en el BIRTH">
          alias {metric.alias}
        </span>
      ) : null}
    </>
  )
}

function MetricValue({ metric }: { metric: SpMetric }): React.JSX.Element {
  const unit = engUnit(metric.properties)
  return (
    <>
      <span className={metric.value === null ? 'value is-null' : 'value'}>
        {formatValue(metric.type, metric.value)}
      </span>
      {unit ? <span className="unit">{unit}</span> : null}
      <span className="value-type">{metric.type}</span>
      {metric.isHistorical ? <span className="mini-tag">histórico</span> : null}
    </>
  )
}

function EventRow({
  row,
  connection,
  selected,
  onSelect,
  onToggle
}: {
  row: Row
  connection: ConnectionConfig | undefined
  selected: boolean
  onSelect: () => void
  onToggle: () => void
}): React.JSX.Element {
  const { event, metric } = row
  const classes = ['event-row', `level-${event.level}`]
  if (selected) classes.push('is-selected')
  if (row.child) classes.push('is-child')
  if (event.ignored) classes.push('is-ignored')
  if (event.invalid) classes.push('is-invalid')

  const isState = event.kind === 'STATE' && event.online !== undefined
  const isText = !row.summary && !metric && !isState
  const hasPath = event.group !== undefined

  let body: React.JSX.Element
  if (row.summary) {
    const metrics = event.metrics ?? []
    const preview = metrics
      .slice(0, 3)
      .map((m) => `${m.name} = ${formatValue(m.type, m.value)}`)
      .join('  ·  ')
    body = (
      <>
        <span className="cell cell-metric">
          <button
            className="expander"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            title={row.open ? 'Ocultar métricas' : 'Ver métricas'}
          >
            {row.open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {metrics.length} métricas
          </button>
        </span>
        <span className="cell cell-value is-preview">{row.open ? '' : `${preview}  ·  …`}</span>
      </>
    )
  } else if (metric) {
    body = (
      <>
        <span className="cell cell-metric">
          <MetricName metric={metric} />
        </span>
        <span className="cell cell-value">
          <MetricValue metric={metric} />
        </span>
      </>
    )
  } else if (isState) {
    body = (
      <>
        <span className="cell cell-metric">
          host {event.hostId}
          {event.self ? <span className="mini-tag">esta app</span> : null}
        </span>
        <span className="cell cell-value">
          <span className={`pill pill-${event.online ? 'online' : 'offline'}`}>
            <span className="pill-dot" />
            {event.online ? 'ONLINE' : 'OFFLINE'}
          </span>
        </span>
      </>
    )
  } else {
    // los eventos que no vienen de un nodo usan tambien esas columnas para el texto
    body = (
      <span
        className="cell cell-text"
        style={{ gridColumn: hasPath ? '7 / -1' : '4 / -1' }}
        title={event.kind === 'RAW' ? `${event.topic}\n${event.text}` : event.text}
      >
        {event.kind === 'RAW' ? <span className="raw-topic">{event.topic}</span> : null}
        {event.text ?? ''}
      </span>
    )
  }

  return (
    <div
      className={classes.join(' ')}
      style={{ '--conn': connection?.color ?? '#666' } as React.CSSProperties}
      onClick={onSelect}
    >
      <span className="cell cell-time">{formatTime(event.receivedAt)}</span>
      <span className="cell">{connection ? <ConnectionChip connection={connection} /> : null}</span>
      <span className="cell cell-type">
        <TypeBadge kind={event.kind} />
        {event.sent ? (
          <span className="sent-mark" title="Publicado por esta app">
            <Send size={12} />
          </span>
        ) : null}
        {event.certificate ? (
          <span className="mini-tag" title="BIRTH guardado por el broker Sparkplug Aware">
            cert
          </span>
        ) : null}
      </span>
      {hasPath || !isText ? (
        <>
          <span className="cell">{event.group ?? <span className="dash">—</span>}</span>
          <span className="cell">{event.node ?? <span className="dash">—</span>}</span>
          <span className="cell">
            {event.device ?? <span className="dash">{hasPath ? '-' : '—'}</span>}
          </span>
        </>
      ) : null}
      {body}
      {event.invalid || event.ignored || event.seqExpected !== undefined ? (
        <span className="row-marks">
          {event.seqExpected !== undefined ? (
            <span
              className="row-mark is-gap"
              title={`Salto de secuencia: se esperaba seq ${event.seqExpected} y llegó ${event.seq}`}
            >
              seq {event.seq} ≠ {event.seqExpected}
            </span>
          ) : null}
          {event.invalid ? (
            <span className="row-mark is-invalid" title={event.invalid}>
              inválido
            </span>
          ) : null}
          {event.ignored ? (
            <span className="row-mark" title={`No se aplicó a los datos: ${event.ignored}`}>
              ignorado
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}

function DetailValue({ metric }: { metric: SpMetric }): React.JSX.Element {
  if (metric.value !== null && typeof metric.value === 'object') {
    return <pre className="detail-json">{formatJson(metric.value)}</pre>
  }
  const unit = engUnit(metric.properties)
  return (
    <span className="value">
      {formatValue(metric.type, metric.value)}
      {unit ? ` ${unit}` : ''}
    </span>
  )
}

function EventDetail({
  selection,
  connection,
  onClose
}: {
  selection: Selection
  connection: ConnectionConfig | undefined
  onClose: () => void
}): React.JSX.Element {
  const { event } = selection
  const metrics = event.metrics ?? []
  const flags = [
    event.retained ? 'retenido' : '',
    event.certificate ? 'certificado del broker' : '',
    event.sent ? 'enviado por esta app' : '',
    event.self && !event.sent ? 'STATE del host de esta app' : ''
  ].filter(Boolean)

  return (
    <aside className="detail">
      <header className="detail-header">
        <TypeBadge kind={event.kind} />
        <h2>Detalle del evento</h2>
        <button className="icon-button" onClick={onClose} title="Cerrar">
          <X size={16} />
        </button>
      </header>
      <div className="detail-body">
        <dl className="detail-facts">
          <dt>Conexión</dt>
          <dd>{connection ? <ConnectionChip connection={connection} /> : '—'}</dd>
          {event.topic ? (
            <>
              <dt>Tópico</dt>
              <dd className="mono">{event.topic}</dd>
            </>
          ) : null}
          <dt>{event.sent ? 'Enviado' : 'Recibido'}</dt>
          <dd className="mono">{formatDateTime(event.receivedAt)}</dd>
          {event.timestamp !== undefined ? (
            <>
              <dt>Timestamp</dt>
              <dd className="mono">{formatDateTime(event.timestamp)}</dd>
            </>
          ) : null}
          {event.seq !== undefined ? (
            <>
              <dt>seq</dt>
              <dd className="mono">
                {event.seq}
                {event.seqExpected !== undefined ? ` (se esperaba ${event.seqExpected})` : ''}
              </dd>
            </>
          ) : null}
          {event.bdSeq !== undefined ? (
            <>
              <dt>bdSeq</dt>
              <dd className="mono">{event.bdSeq}</dd>
            </>
          ) : null}
          {event.bytes !== undefined ? (
            <>
              <dt>Tamaño</dt>
              <dd className="mono">{event.bytes} bytes</dd>
            </>
          ) : null}
          {flags.length ? (
            <>
              <dt>Marcas</dt>
              <dd>{flags.join(' · ')}</dd>
            </>
          ) : null}
        </dl>

        {event.text ? <p className="detail-text">{event.text}</p> : null}
        {event.invalid ? (
          <div className="notice notice-error">
            <TriangleAlert size={15} />
            <span>{event.invalid} No se aplicó a los datos.</span>
          </div>
        ) : null}
        {event.seqExpected !== undefined ? (
          <div className="notice notice-warn">
            <TriangleAlert size={15} />
            <span>
              Salto de secuencia: después del seq anterior del nodo tenía que llegar{' '}
              {event.seqExpected} y llegó {event.seq}.
            </span>
          </div>
        ) : null}
        {event.ignored ? (
          <div className="notice notice-warn">
            <TriangleAlert size={15} />
            <span>No se aplicó a los datos: {event.ignored}</span>
          </div>
        ) : null}

        {metrics.length ? (
          <>
            <h3 className="detail-title">Métricas ({metrics.length})</h3>
            {metrics.slice(0, DETAIL_METRICS).map((metric, i) => (
              <div
                key={i}
                className={`detail-metric${metric === selection.metric ? ' is-selected' : ''}`}
              >
                <div className="detail-metric-name">
                  <MetricName metric={metric} />
                </div>
                <DetailValue metric={metric} />
                <div className="detail-metric-meta">
                  {metric.type}
                  {metric.alias !== undefined ? ` · alias ${metric.alias}` : ''}
                  {metric.timestamp !== undefined ? ` · ${formatDateTime(metric.timestamp)}` : ''}
                  {metric.isHistorical ? ' · histórico' : ''}
                  {metric.isTransient ? ' · transitorio' : ''}
                </div>
                {metric.properties ? (
                  <div className="detail-props">
                    {Object.entries(metric.properties).map(([key, property]) => (
                      <span key={key}>
                        {key}: {formatValue(property.type, property.value)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {metrics.length > DETAIL_METRICS ? (
              <p className="detail-text">… y {metrics.length - DETAIL_METRICS} métricas más</p>
            ) : null}
          </>
        ) : null}
      </div>
    </aside>
  )
}

export function EventsView({ active }: { active: boolean }): React.JSX.Element | null {
  const version = useStoreVersion()
  const [query, setQuery] = useState('')
  const [hiddenConnections, setHiddenConnections] = useState<Set<string>>(new Set())
  const [hiddenGroups, setHiddenGroups] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [selection, setSelection] = useState<Selection | null>(null)
  /** En pausa se muestra una copia fija de los eventos para que la lista no se mueva */
  const [frozen, setFrozen] = useState<SpEvent[] | null>(null)

  const { connections } = store
  const byId = useMemo(() => new Map(connections.map((c) => [c.id, c])), [connections])
  const names = useMemo(
    () => new Map(connections.map((c) => [c.id, connectionLabel(c)])),
    [connections]
  )

  const source = frozen ?? store.events
  const tick = frozen || !active ? 0 : version
  const rows = useMemo(
    () =>
      active ? buildRows(source, names, hiddenConnections, hiddenGroups, query, expanded) : [],
    // tick: store.events se modifica en el lugar, la version avisa que cambio
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, source, tick, names, hiddenConnections, hiddenGroups, query, expanded]
  )

  if (!active) return null

  const lastId = (events: SpEvent[]): number => events[events.length - 1]?.id ?? 0
  const missed = frozen ? lastId(store.events) - lastId(frozen) : 0
  const pause = (): void => setFrozen(store.events.slice())
  const resume = (): void => setFrozen(null)

  return (
    <section className="view view-events">
      <header className="view-header">
        <div>
          <h1>Eventos</h1>
          <p>Mensajes decodificados de todas las conexiones, en orden de llegada.</p>
        </div>
        <div className="header-actions">
          {frozen ? (
            <button className="button button-primary" onClick={resume}>
              <ArrowDown size={14} /> Seguir en vivo{missed > 0 ? ` · ${missed} nuevos` : ''}
            </button>
          ) : (
            <button className="button" onClick={pause}>
              <Pause size={14} /> Pausar
            </button>
          )}
          <button
            className="button"
            onClick={() => {
              store.clearEvents()
              setFrozen(null)
              setSelection(null)
            }}
          >
            <Eraser size={14} /> Limpiar
          </button>
        </div>
      </header>

      <div className="toolbar">
        <label className="search">
          <Search size={14} />
          <input
            value={query}
            placeholder="Filtrar por grupo, nodo, device, métrica o valor…"
            spellCheck={false}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button className="icon-button" onClick={() => setQuery('')} title="Borrar filtro">
              <X size={13} />
            </button>
          ) : null}
        </label>
        {connections.length ? (
          <ConnectionFilter
            connections={connections}
            hidden={hiddenConnections}
            onChange={setHiddenConnections}
          />
        ) : null}
        <div className="chips">
          {FILTER_GROUPS.map((group) => (
            <button
              key={group.id}
              className={`chip chip-type type-${group.id}${hiddenGroups.has(group.id) ? ' is-off' : ''}`}
              onClick={() => setHiddenGroups((set) => toggled(set, [group.id]))}
              title={group.title}
            >
              {group.id === 'sent' ? <Send size={11} /> : null}
              {group.label}
            </button>
          ))}
        </div>
        <span className="toolbar-count">{rows.length} filas</span>
      </div>

      <div className="events-layout">
        <div className="table">
          <div className="event-row table-head">
            <span className="cell">Hora</span>
            <span className="cell">Conexión</span>
            <span className="cell">Tipo</span>
            <span className="cell">Grupo</span>
            <span className="cell">Nodo</span>
            <span className="cell">Device</span>
            <span className="cell">Métrica</span>
            <span className="cell">Valor</span>
          </div>
          {rows.length ? (
            <VirtualList
              className="table-body"
              items={rows}
              rowHeight={ROW_HEIGHT}
              follow={!frozen}
              onFollowChange={(follow) => (follow ? resume() : pause())}
              render={(row) => (
                <EventRow
                  key={row.key}
                  row={row}
                  connection={byId.get(row.event.connectionId)}
                  selected={
                    selection?.event === row.event &&
                    (row.summary || selection.metric === row.metric)
                  }
                  onSelect={() => setSelection({ event: row.event, metric: row.metric })}
                  onToggle={() => setExpanded((set) => toggled(set, [row.event.id]))}
                />
              )}
            />
          ) : (
            <div className="empty">
              <h2>{store.events.length ? 'Nada coincide con el filtro' : 'Sin eventos todavía'}</h2>
              <p>
                {store.events.length
                  ? 'Probá con otro texto o volvé a activar los tipos y conexiones ocultos.'
                  : 'Conectá un broker desde Conexiones para empezar a ver mensajes.'}
              </p>
            </div>
          )}
        </div>
        {selection ? (
          <EventDetail
            selection={selection}
            connection={byId.get(selection.event.connectionId)}
            onClose={() => setSelection(null)}
          />
        ) : null}
      </div>
    </section>
  )
}
