import { useEffect, useRef, useState } from 'react'
import { Cable, Check, ChevronDown, Search } from 'lucide-react'
import { connectionLabel } from '@shared/connection'
import type { ConnectionConfig } from '@shared/types'

interface ConnectionFilterProps {
  connections: ConnectionConfig[]
  /** Conexiones ocultas: las nuevas arrancan visibles */
  hidden: Set<string>
  onChange: (hidden: Set<string>) => void
}

/** Con esta cantidad de conexiones la lista suma un buscador */
const SEARCH_FROM = 8

/**
 * Filtro de conexiones en un desplegable: ocupa lo mismo en la barra haya 2
 * conexiones o 50, y adentro se tildan las que se quieren ver.
 */
export function ConnectionFilter({
  connections,
  hidden,
  onChange
}: ConnectionFilterProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visible = connections.filter((connection) => !hidden.has(connection.id))
  const all = visible.length === connections.length

  let label: React.ReactNode
  if (all) label = 'Todas las conexiones'
  else if (visible.length === 0) label = 'Ninguna conexión'
  else if (visible.length === 1) {
    label = (
      <>
        <span className="conn-dot" style={{ background: visible[0].color }} />
        <span className="filter-label">{connectionLabel(visible[0])}</span>
      </>
    )
  } else label = `${visible.length} de ${connections.length} conexiones`

  const toggle = (id: string): void => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }
  const only = (id: string): void => {
    onChange(new Set(connections.filter((c) => c.id !== id).map((c) => c.id)))
  }

  const term = query.trim().toLowerCase()
  const listed = term
    ? connections.filter((c) => connectionLabel(c).toLowerCase().includes(term))
    : connections

  return (
    <div className="filter" ref={root}>
      <button
        className={`filter-button${all ? '' : ' is-active'}`}
        onClick={() => setOpen((value) => !value)}
        title="Elegir de qué conexiones se muestran los eventos"
      >
        {all || visible.length !== 1 ? <Cable size={14} /> : null}
        {label}
        <ChevronDown size={14} />
      </button>

      {open ? (
        <div className="filter-popover">
          {connections.length >= SEARCH_FROM ? (
            <label className="search filter-search">
              <Search size={13} />
              <input
                autoFocus
                value={query}
                placeholder="Buscar conexión…"
                spellCheck={false}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          ) : null}
          <div className="filter-actions">
            <button className="link-button" onClick={() => onChange(new Set())}>
              Todas
            </button>
            <button
              className="link-button"
              onClick={() => onChange(new Set(connections.map((c) => c.id)))}
            >
              Ninguna
            </button>
            <span className="filter-count">
              {visible.length} de {connections.length}
            </span>
          </div>
          <div className="filter-list">
            {listed.map((connection) => {
              const checked = !hidden.has(connection.id)
              return (
                <div key={connection.id} className="filter-option">
                  <button
                    className="filter-option-main"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(connection.id)}
                  >
                    <span className={`checkbox${checked ? ' is-checked' : ''}`}>
                      {checked ? <Check size={11} strokeWidth={3} /> : null}
                    </span>
                    <span className="conn-dot" style={{ background: connection.color }} />
                    <span className="filter-label">{connectionLabel(connection)}</span>
                  </button>
                  <button
                    className="filter-only"
                    onClick={() => only(connection.id)}
                    title="Ver solo esta conexión"
                  >
                    solo
                  </button>
                </div>
              )
            })}
            {listed.length ? null : <div className="filter-empty">Ninguna coincide</div>}
          </div>
        </div>
      ) : null}
    </div>
  )
}
