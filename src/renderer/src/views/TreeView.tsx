import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Lock,
  Pencil,
  RefreshCw,
  Search,
  TriangleAlert,
  X
} from 'lucide-react'
import { isReadOnly } from '@shared/command'
import type { Liveness } from '@shared/types'
import { ConnectionStatePill, KindIcon, LivenessPill } from '../components/badges'
import { VirtualList } from '../components/VirtualList'
import { engUnit, formatDateTime, formatTimestamp, formatValue, plural } from '../format'
import { FLASH_MS, store, useStoreVersion } from '../store'
import {
  buildTree,
  flattenTree,
  hiddenUpdateAt,
  isWritable,
  leafOf,
  type Search as TreeSearch,
  type SearchScope,
  type TreeItem
} from '../tree'
import { CommandPanel } from './CommandPanel'

const ROW_HEIGHT = 28
const INDENT = 18

function everyItem(roots: TreeItem[], visit: (item: TreeItem) => void): void {
  for (const item of roots) {
    visit(item)
    everyItem(item.children, visit)
  }
}

function OfflineBadge({ count }: { count: number }): React.JSX.Element | null {
  if (!count) return null
  return (
    <span className="offline-badge" title="Nodos y devices offline dentro de este elemento">
      {count} offline
    </span>
  )
}

function TreeRow({
  item,
  open,
  flat,
  selected,
  hiddenUpdateAt,
  onToggle,
  onSelect
}: {
  item: TreeItem
  open: boolean
  /** Fila de una busqueda plana: sin sangria ni chevron, es una linea suelta */
  flat: boolean
  selected: boolean
  /** Ultima actualizacion entre lo que cuelga de la fila y no esta en la lista */
  hiddenUpdateAt: number
  onToggle: () => void
  onSelect: () => void
}): React.JSX.Element {
  // metrica o miembro de UDT que muestra la fila, si es una fila de datos
  const metric = leafOf(item)
  // las metricas que se pueden escribir se eligen con un clic para mandarles un comando
  const writable = isWritable(item, metric)
  const readOnly =
    item.kind === 'metric' &&
    !item.parameter &&
    (isReadOnly(metric?.properties) || isReadOnly(item.metric?.properties))
  const now = store.now
  // lo que cambia debajo sin estar a la vista destella en el nombre de la fila
  const freshBelow = now - hiddenUpdateAt < FLASH_MS
  // estado del nodo o device del que depende la fila; las ramas intermedias no tienen
  const state = item.node ?? item.device
  const liveness: Liveness | undefined = (state ?? item.owner)?.status
  const classes = ['tree-row', `tree-${item.kind}`]
  if (liveness && liveness !== 'online') classes.push(`is-${liveness}`)
  if (writable) classes.push('is-writable')
  if (selected) classes.push('is-selected')

  let value: React.JSX.Element | null = null
  let type = ''
  let updated = ''
  let updatedTitle: string | undefined

  if (metric && item.kind === 'template') {
    // la fila del UDT resume; los valores estan en las filas de sus miembros
    value = <span className="tree-summary">{formatValue(metric.type, metric.value)}</span>
    type = metric.type
    updated = formatTimestamp(metric.timestamp ?? metric.updatedAt, now)
    updatedTitle = `Recibido: ${formatDateTime(metric.updatedAt)}\nActualizaciones: ${metric.updates}`
  } else if (metric) {
    const unit = engUnit(metric.properties)
    const flash = now - metric.updatedAt < FLASH_MS && metric.updates > 1
    value = (
      <>
        {metric.unresolved ? (
          <span className="unresolved" title="Alias sin resolver: falta el BIRTH del nodo">
            <TriangleAlert size={12} />
          </span>
        ) : null}
        <span
          key={metric.updates}
          className={`value${metric.value === null ? ' is-null' : ''}${flash ? ' is-fresh' : ''}`}
          title={
            liveness === 'offline'
              ? 'Último valor conocido antes del DEATH'
              : liveness === 'stale'
                ? 'Último valor conocido, sin confirmación en vivo'
                : undefined
          }
        >
          {formatValue(metric.type, metric.value)}
        </span>
        {unit ? <span className="unit">{unit}</span> : null}
      </>
    )
    type = metric.type
    // los parametros de un UDT no llevan timestamp
    updated = item.parameter ? '' : formatTimestamp(metric.timestamp ?? metric.updatedAt, now)
    updatedTitle = `Timestamp de la métrica: ${metric.timestamp !== undefined ? formatDateTime(metric.timestamp) : '—'}\nRecibido: ${formatDateTime(metric.updatedAt)}\nActualizaciones: ${metric.updates}${metric.alias !== undefined ? `\nAlias: ${metric.alias}` : ''}`
  } else if (item.kind === 'connection') {
    value = (
      <>
        <ConnectionStatePill status={store.status(item.connection.id)} />
        <span className="tree-summary">
          {item.nodes
            ? `${plural(item.nodes, 'nodo')} · ${plural(item.devices, 'device')} · ${plural(item.metrics, 'métrica')}`
            : 'sin datos'}
        </span>
        <OfflineBadge count={item.offlineBelow} />
      </>
    )
  } else {
    value = (
      <>
        {state ? <LivenessPill status={state.status} at={state.statusAt} now={now} /> : null}
        <OfflineBadge count={item.offlineBelow} />
        {item.node && item.node.birthAt === undefined ? (
          <span className="mini-tag is-warn" title="Todavía no se recibió el NBIRTH de este nodo">
            sin BIRTH
          </span>
        ) : null}
        {item.device && item.device.birthAt === undefined ? (
          <span className="mini-tag is-warn" title="Todavía no se recibió el DBIRTH de este device">
            sin BIRTH
          </span>
        ) : null}
      </>
    )
    if (state?.birthAt !== undefined) {
      updated = formatTimestamp(state.birthAt, now)
      updatedTitle = `Último BIRTH: ${formatDateTime(state.birthAt)}`
    }
  }

  const node = item.node
  const canRebirth = node && store.status(item.connection.id)?.state === 'connected'

  return (
    <div className={classes.join(' ')} onClick={writable ? onSelect : undefined}>
      <span
        className="cell tree-name"
        style={{ paddingLeft: 8 + (flat ? 0 : item.depth * INDENT) }}
      >
        {item.children.length && !flat ? (
          <button className="twisty" onClick={onToggle}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="twisty" />
        )}
        <KindIcon
          kind={item.kind}
          color={item.kind === 'connection' ? item.connection.color : undefined}
          dead={liveness === 'offline' && !item.metric}
        />
        <span
          key={hiddenUpdateAt}
          className={`tree-label${freshBelow ? ' is-fresh' : ''}`}
          title={item.nodeLevel ? 'Métricas propias del nodo' : item.label}
        >
          {item.label}
        </span>
        {item.nodeLevel ? <span className="tree-hint">métricas del nodo</span> : null}
        {item.parameter ? (
          <span className="mini-tag" title="Parámetro del UDT">
            parámetro
          </span>
        ) : null}
        {readOnly ? (
          <span className="read-only" title="El nodo la declara de solo lectura">
            <Lock size={11} />
          </span>
        ) : null}
        {writable ? (
          // el clic lo recibe la fila, igual que en el resto de su superficie
          <button className="row-action" title="Enviar un comando para cambiarle el valor">
            <Pencil size={12} /> Escribir
          </button>
        ) : null}
        {canRebirth ? (
          <button
            className="row-action"
            title="Pedir rebirth a este nodo (NCMD Node Control/Rebirth)"
            onClick={() => window.api.requestRebirth(item.connection.id, node.group, node.id)}
          >
            <RefreshCw size={12} /> Rebirth
          </button>
        ) : null}
      </span>
      <span className="cell tree-value">{value}</span>
      <span className="cell tree-type">{type}</span>
      <span className="cell tree-updated" title={updatedTitle}>
        {updated}
      </span>
    </div>
  )
}

/** Como se interpreta el texto buscado: la fila contiene todas las palabras, o encaja con la regex */
type SearchMode = 'contains' | 'regex'

/**
 * Funcion de coincidencia para el texto, segun el modo. Con una regex que no
 * compila no hay busqueda, y queda el error para mostrarlo en el cuadro.
 */
function compileSearch(
  query: string,
  mode: SearchMode,
  scope: SearchScope
): { search: TreeSearch | null; error: string | null } {
  if (!query.trim()) return { search: null, error: null }
  if (mode === 'regex') {
    try {
      const pattern = new RegExp(query, 'i')
      return { search: { matches: (label) => pattern.test(label), scope }, error: null }
    } catch (error) {
      return { search: null, error: error instanceof Error ? error.message : String(error) }
    }
  }
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = (label: string): boolean => {
    const lower = label.toLowerCase()
    return terms.every((term) => lower.includes(term))
  }
  return { search: { matches, scope }, error: null }
}

export function TreeView({ active }: { active: boolean }): React.JSX.Element | null {
  useStoreVersion()
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('contains')
  const [scope, setScope] = useState<SearchScope>('lineage')
  /** Solo lo que el usuario abrio o cerro a mano; el resto usa el estado por defecto */
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map())
  /**
   * Lo mismo, pero dentro del resultado de una busqueda: empieza vacio con cada
   * busqueda, se conserva mientras se refina el texto y se descarta al borrarlo
   * o al cambiar el alcance, que redefine como arranca cada coincidencia.
   */
  const [searchOverrides, setSearchOverrides] = useState<Map<string, boolean>>(new Map())
  /** Fila elegida para mandarle un comando */
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const { connections, structure, settings } = store
  const separator = settings.splitLevels ? settings.levelSeparator : null
  const roots = useMemo(
    () => (active ? buildTree(connections, (id) => store.model(id), separator) : []),
    // structure avisa cuando cambio la forma del arbol dentro de los modelos
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, connections, structure, separator]
  )
  const { search, error } = useMemo(() => compileSearch(query, mode, scope), [query, mode, scope])
  const searching = search !== null
  /** Busqueda plana: solo las lineas que coinciden, nada que abrir ni cerrar */
  const flat = searching && scope === 'flat'
  const decisions = searching ? searchOverrides : overrides
  const setDecisions = searching ? setSearchOverrides : setOverrides
  const { rows, open } = useMemo(
    () => flattenTree(roots, (item) => decisions.get(item.key), search),
    [roots, decisions, search]
  )
  // las filas de la lista, esten o no en pantalla: lo que no esta aca destella en su rama
  const listed = useMemo(() => new Set(rows), [rows])
  // se busca por clave en cada pasada: el arbol se rearma cuando cambia su forma
  const selected = useMemo(() => {
    let found: TreeItem | undefined
    if (selectedKey !== null) {
      everyItem(roots, (item) => {
        if (item.key === selectedKey) found = item
      })
    }
    return found
  }, [roots, selectedKey])

  if (!active) return null

  const selectedLeaf = selected && leafOf(selected)
  const target = selected && selectedLeaf && isWritable(selected, selectedLeaf) ? selected : null

  const setAll = (value: boolean): void => {
    const next = new Map<string, boolean>()
    everyItem(roots, (item) => {
      // al colapsar todo quedan a la vista las conexiones
      if (item.children.length) next.set(item.key, value)
    })
    setDecisions(next)
  }
  const toggle = (item: TreeItem): void => {
    setDecisions((current) => new Map(current).set(item.key, !open.has(item)))
  }
  const changeQuery = (value: string): void => {
    setQuery(value)
    if (!value.trim()) setSearchOverrides(new Map())
  }
  const changeScope = (value: SearchScope): void => {
    setScope(value)
    setSearchOverrides(new Map())
  }
  const hasData = roots.some((root) => root.children.length)

  return (
    <section className="view view-tree">
      <header className="view-header">
        <div>
          <h1>Árbol de datos</h1>
          <p>
            Último valor de cada métrica, por conexión, grupo, nodo y device. Un clic en una métrica
            permite enviarle un comando.
          </p>
        </div>
        <div className="header-actions">
          <button className="button" onClick={() => setAll(true)} disabled={flat}>
            <ChevronsUpDown size={14} /> Expandir todo
          </button>
          <button className="button" onClick={() => setAll(false)} disabled={flat}>
            <ChevronsDownUp size={14} /> Colapsar todo
          </button>
        </div>
      </header>

      <div className="toolbar">
        <label className={`search${error ? ' is-invalid' : ''}`} title={error ?? undefined}>
          <Search size={14} />
          <input
            value={query}
            placeholder={
              mode === 'regex'
                ? 'Regex sobre el nombre de la fila…'
                : 'Buscar grupo, nodo, device o métrica…'
            }
            spellCheck={false}
            onChange={(e) => changeQuery(e.target.value)}
          />
          {query ? (
            <button className="icon-button" onClick={() => changeQuery('')} title="Borrar búsqueda">
              <X size={13} />
            </button>
          ) : null}
        </label>
        <div className="chips">
          <button
            className={`chip chip-option${mode === 'regex' ? '' : ' is-off'}`}
            onClick={() => setMode(mode === 'regex' ? 'contains' : 'regex')}
            title="Interpretar el texto como expresión regular sobre el nombre de la fila, sin distinguir mayúsculas. Apagado: la fila contiene todas las palabras del texto"
          >
            Regex
          </button>
          <button
            className={`chip chip-option${scope === 'lineage' ? '' : ' is-off'}`}
            onClick={() => changeScope(scope === 'lineage' ? 'flat' : 'lineage')}
            title="Mostrar cada coincidencia con su camino arriba y todo lo que cuelga de ella. Apagado: solo las líneas que coinciden, una debajo de otra"
          >
            Mostrar herencia
          </button>
        </div>
        <div className="legend">
          <span>
            <KindIcon kind="connection" /> Conexión
          </span>
          <span>
            <KindIcon kind="group" /> Group
          </span>
          <span>
            <KindIcon kind="node" /> Nodo
          </span>
          <span>
            <KindIcon kind="device" /> Device
          </span>
          <span>
            <KindIcon kind="metric" /> Métrica
          </span>
          <span>
            <KindIcon kind="template" /> UDT
          </span>
        </div>
      </div>

      <div className={`tree-layout${target ? ' has-panel' : ''}`}>
        <div className="table">
          <div className="tree-row table-head">
            <span className="cell">Nombre</span>
            <span className="cell">Valor / estado</span>
            <span className="cell">Tipo</span>
            <span className="cell">Actualizado</span>
          </div>
          {connections.length && (hasData || rows.length) ? (
            <VirtualList
              className="table-body"
              items={rows}
              rowHeight={ROW_HEIGHT}
              render={(item) => (
                <TreeRow
                  key={item.key}
                  item={item}
                  open={open.has(item)}
                  flat={flat}
                  selected={item.key === target?.key}
                  hiddenUpdateAt={hiddenUpdateAt(item, listed)}
                  onToggle={() => toggle(item)}
                  onSelect={() => setSelectedKey(item.key)}
                />
              )}
            />
          ) : (
            <div className="empty">
              <h2>{connections.length ? 'Sin datos todavía' : 'No hay conexiones'}</h2>
              <p>
                {connections.length
                  ? 'El árbol se arma con los BIRTH y DATA que llegan de las conexiones activas.'
                  : 'Agregá un broker desde Conexiones para empezar.'}
              </p>
            </div>
          )}
        </div>
        {target && selectedLeaf ? (
          <CommandPanel
            key={target.key}
            item={target}
            leaf={selectedLeaf}
            onClose={() => setSelectedKey(null)}
          />
        ) : null}
      </div>
    </section>
  )
}
