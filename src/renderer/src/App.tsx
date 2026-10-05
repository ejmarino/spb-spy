import { useState } from 'react'
import { Cable, ListTree, Play, Radar, ScrollText, Square } from 'lucide-react'
import { connectionLabel } from '@shared/connection'
import { store, useStoreVersion } from './store'
import { ConnectionsView } from './views/ConnectionsView'
import { EventsView } from './views/EventsView'
import { TreeView } from './views/TreeView'

type View = 'connections' | 'events' | 'tree'

const VIEWS = [
  { id: 'connections', label: 'Conexiones', icon: Cable },
  { id: 'events', label: 'Eventos', icon: ScrollText },
  { id: 'tree', label: 'Árbol de datos', icon: ListTree }
] as const

const STATE_TITLES = {
  disconnected: 'Desconectada',
  connecting: 'Conectando…',
  connected: 'Conectada',
  reconnecting: 'Reintentando…'
}

function App(): React.JSX.Element {
  useStoreVersion()
  const [view, setView] = useState<View>('connections')

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
                <span className={`state-dot state-${state}`} title={STATE_TITLES[state]} />
                <span className="sidebar-connection-name">{connectionLabel(connection)}</span>
                <button
                  className="icon-button"
                  title={idle ? 'Conectar' : 'Desconectar'}
                  onClick={() =>
                    idle ? window.api.connect(connection.id) : window.api.disconnect(connection.id)
                  }
                >
                  {idle ? <Play size={13} /> : <Square size={12} />}
                </button>
              </li>
            )
          })}
          {store.connections.length ? null : <li className="sidebar-empty">Ninguna todavía</li>}
        </ul>
      </aside>

      <main className="main">
        <ConnectionsView active={view === 'connections'} />
        <EventsView active={view === 'events'} />
        <TreeView active={view === 'tree'} />
      </main>
    </div>
  )
}

export default App
