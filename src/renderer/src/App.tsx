import { useState } from 'react'
import {
  Cable,
  Download,
  Info,
  ListTree,
  Orbit,
  Play,
  Radar,
  ScrollText,
  Settings as SettingsIcon,
  Square,
  TriangleAlert
} from 'lucide-react'
import { connectionLabel } from '@shared/connection'
import type { ConnectionStats, UpdateStatus } from '@shared/types'
import { formatByteRate, formatRate, plural } from './format'
import { store, useStoreVersion } from './store'
import { About } from './views/About'
import { ConnectionsView } from './views/ConnectionsView'
import { EventsView } from './views/EventsView'
import { GraphView } from './views/GraphView'
import { Settings } from './views/Settings'
import { TreeView } from './views/TreeView'

type View = 'connections' | 'events' | 'tree' | 'graph'

const VIEWS = [
  { id: 'connections', label: 'Conexiones', icon: Cable },
  { id: 'events', label: 'Eventos', icon: ScrollText },
  { id: 'tree', label: 'Árbol de datos', icon: ListTree },
  { id: 'graph', label: 'Visualización de datos', icon: Orbit }
] as const

const STATE_TITLES = {
  disconnected: 'Desconectada',
  connecting: 'Conectando…',
  connected: 'Conectada',
  reconnecting: 'Reintentando…'
}

/** Aviso del panel lateral cuando hay una version nueva para bajar o instalar */
function updateNotice({ state, version, percent }: UpdateStatus): string | null {
  if (state === 'available') return `Versión ${version} disponible`
  if (state === 'downloading') return `Descargando ${version}… ${percent ?? 0} %`
  if (state === 'downloaded') return `Versión ${version} lista para instalar`
  return null
}

/** Caudal de una conexion conectada, debajo de su nombre en el panel lateral */
function ConnectionRates({ stats }: { stats: ConnectionStats }): React.JSX.Element {
  const gaps = stats.gaps ? plural(stats.gaps, 'salto') : null
  const title = [
    'Promedio de los últimos 5 segundos:',
    `${formatRate(stats.messages)} mensajes por segundo`,
    `${formatRate(stats.metrics)} métricas por segundo`,
    `${formatByteRate(stats.bytes)} de payload`,
    gaps
      ? `\n${gaps} de secuencia desde que se conectó: puede haber mensajes perdidos, o un nodo que numera mal.`
      : ''
  ]
    .filter(Boolean)
    .join('\n')
  return (
    <div className="sidebar-rates" title={title}>
      <span>{formatRate(stats.messages)} msg/s</span>
      <span>{formatRate(stats.metrics)} mét/s</span>
      <span>{formatByteRate(stats.bytes)}</span>
      {gaps ? (
        <span className="sidebar-gaps">
          <TriangleAlert size={11} /> {gaps}
        </span>
      ) : null}
    </div>
  )
}

function App(): React.JSX.Element {
  useStoreVersion()
  const [view, setView] = useState<View>('connections')
  const [modal, setModal] = useState<'settings' | 'about' | null>(null)
  const notice = updateNotice(store.update)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <Radar size={20} />
          <div>
            <strong>SpbSpy</strong>
            <span>Visor Sparkplug B</span>
          </div>
        </div>

        <nav className="nav">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item${view === id ? ' is-active' : ''}`}
              onClick={() => setView(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-title">Conexiones</div>
        <ul className="sidebar-connections">
          {store.connections.map((connection) => {
            const state = store.status(connection.id)?.state ?? 'disconnected'
            const idle = state === 'disconnected'
            return (
              <li key={connection.id} style={{ '--conn': connection.color } as React.CSSProperties}>
                <div className="sidebar-connection">
                  <span className={`state-dot state-${state}`} title={STATE_TITLES[state]} />
                  <span className="sidebar-connection-name">{connectionLabel(connection)}</span>
                  <button
                    className="icon-button"
                    title={idle ? 'Conectar' : 'Desconectar'}
                    onClick={() =>
                      idle
                        ? window.api.connect(connection.id)
                        : window.api.disconnect(connection.id)
                    }
                  >
                    {idle ? <Play size={13} /> : <Square size={12} />}
                  </button>
                </div>
                {state === 'connected' ? (
                  <ConnectionRates stats={store.rates(connection.id)} />
                ) : null}
              </li>
            )
          })}
          {store.connections.length ? null : <li className="sidebar-empty">Ninguna todavía</li>}
        </ul>

        <div className="sidebar-footer">
          {notice ? (
            <button className="sidebar-update" onClick={() => setModal('settings')}>
              <Download size={14} />
              {notice}
            </button>
          ) : null}
          <button className="nav-item" onClick={() => setModal('settings')}>
            <SettingsIcon size={16} />
            Configuración
          </button>
          <button className="nav-item" onClick={() => setModal('about')}>
            <Info size={16} />
            Acerca de {__APP_NAME__}
          </button>
        </div>
      </aside>

      <main className="main">
        <ConnectionsView active={view === 'connections'} />
        <EventsView active={view === 'events'} />
        <TreeView active={view === 'tree'} />
        <GraphView active={view === 'graph'} />
      </main>

      {modal === 'settings' ? <Settings onClose={() => setModal(null)} /> : null}
      {modal === 'about' ? <About onClose={() => setModal(null)} /> : null}
    </div>
  )
}

export default App
