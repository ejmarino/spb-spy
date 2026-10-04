import { useState } from 'react'
import { Lock, Pencil, Play, Plus, ShieldCheck, Square, Trash, TriangleAlert } from 'lucide-react'
import { connectionLabel, connectionUrl, newConnection, topicWarning } from '@shared/connection'
import type { ConnectionConfig, RebirthPolicy } from '@shared/types'
import { ConnectionStatePill, KindIcon } from '../components/badges'
import { plural } from '../format'
import { store, useStoreVersion } from '../store'
import { ConnectionForm } from './ConnectionForm'

const REBIRTH_LABELS: Record<RebirthPolicy, string> = {
  'missing-birth': 'sin BIRTH o salto de seq',
  alias: 'alias sin resolver',
  never: 'nunca'
}

const REBIRTH_TITLES: Record<RebirthPolicy, string> = {
  'missing-birth': 'Pide rebirth cuando falta el BIRTH de un nodo o device, o cuando su seq salta',
  alias: 'Pide rebirth solo cuando llegan alias que no se pueden resolver',
  never: 'No pide rebirth'
}

function ConnectionCard({
  connection,
  onEdit
}: {
  connection: ConnectionConfig
  onEdit: () => void
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const status = store.status(connection.id)
  const state = status?.state ?? 'disconnected'
  const model = store.model(connection.id)
  const warning = topicWarning(connection.topic)

  let devices = 0
  let metrics = 0
  for (const node of model?.nodes.values() ?? []) {
    devices += node.devices.size
    metrics += node.metrics.size
    for (const device of node.devices.values()) metrics += device.metrics.size
  }

  return (
    <article className="card" style={{ '--conn': connection.color } as React.CSSProperties}>
      <header className="card-header">
        <KindIcon kind="connection" color={connection.color} />
        <h3>{connectionLabel(connection)}</h3>
        <ConnectionStatePill status={status} />
      </header>

      <div className="card-url">{connectionUrl(connection)}</div>

      <dl className="card-facts">
        <dt>Cliente / Host ID</dt>
        <dd>{connection.clientId}</dd>
        <dt>Tópico</dt>
        <dd>
          {connection.topic}
          {warning ? (
            <span className="warn-mark" title={warning}>
              <TriangleAlert size={13} /> no estándar
            </span>
          ) : null}
        </dd>
        <dt>Rebirth</dt>
        <dd
          title={
            connection.rebirthPolicy === 'never'
              ? REBIRTH_TITLES.never
              : `${REBIRTH_TITLES[connection.rebirthPolicy]}; como máximo una vez cada ${connection.rebirthCooldown} s por nodo`
          }
        >
          {REBIRTH_LABELS[connection.rebirthPolicy]}
          {connection.rebirthPolicy === 'never' ? '' : ` · c/${connection.rebirthCooldown} s`}
        </dd>
      </dl>

      <div className="card-tags">
        {connection.tls ? (
          <span className="tag">
            <Lock size={12} /> TLS
          </span>
        ) : null}
        {connection.sparkplugAware ? (
          <span className="tag">
            <ShieldCheck size={12} /> Sparkplug Aware
          </span>
        ) : null}
        {model?.nodes.size ? (
          <span className="tag tag-plain">
            {plural(model.nodes.size, 'nodo')} · {plural(devices, 'device')} ·{' '}
            {plural(metrics, 'métrica')}
          </span>
        ) : null}
      </div>

      {status?.error && state !== 'connected' ? (
        <div className="notice notice-error">
          <TriangleAlert size={15} />
          <span>{status.error}</span>
        </div>
      ) : null}

      <footer className="card-actions">
        {state === 'disconnected' ? (
          <button
            className="button button-primary"
            onClick={() => window.api.connect(connection.id)}
          >
            <Play size={14} /> Conectar
          </button>
        ) : (
          <button className="button" onClick={() => window.api.disconnect(connection.id)}>
            <Square size={13} /> Desconectar
          </button>
        )}
        <span className="spacer" />
        {confirming ? (
          <>
            <span className="confirm-text">¿Eliminar?</span>
            <button
              className="button button-danger"
              onClick={() => store.deleteConnection(connection.id)}
            >
              Sí, eliminar
            </button>
            <button className="button" onClick={() => setConfirming(false)}>
              No
            </button>
          </>
        ) : (
          <>
            <button className="icon-button" onClick={onEdit} title="Editar">
              <Pencil size={15} />
            </button>
            <button className="icon-button" onClick={() => setConfirming(true)} title="Eliminar">
              <Trash size={15} />
            </button>
          </>
        )}
      </footer>
    </article>
  )
}

export function ConnectionsView({ active }: { active: boolean }): React.JSX.Element | null {
  useStoreVersion()
  const [editing, setEditing] = useState<{ config: ConnectionConfig; isNew: boolean } | null>(null)
  if (!active) return null

  const { connections } = store
  const create = (): void => setEditing({ config: newConnection(connections), isNew: true })

  return (
    <section className="view">
      <header className="view-header">
        <div>
          <h1>Conexiones</h1>
          <p>Brokers MQTT donde la app escucha el tráfico Sparkplug B.</p>
        </div>
        <button className="button button-primary" onClick={create}>
          <Plus size={15} /> Nueva conexión
        </button>
      </header>

      {connections.length ? (
        <div className="cards">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.id}
              connection={connection}
              onEdit={() => setEditing({ config: connection, isNew: false })}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <KindIcon kind="connection" />
          <h2>Todavía no hay conexiones</h2>
          <p>Agregá un broker MQTT para empezar a ver los mensajes Sparkplug B.</p>
          <button className="button button-primary" onClick={create}>
            <Plus size={15} /> Nueva conexión
          </button>
        </div>
      )}

      {editing ? (
        <ConnectionForm
          key={editing.config.id}
          initial={editing.config}
          isNew={editing.isNew}
          onCancel={() => setEditing(null)}
          onSave={async (config) => {
            await store.saveConnection(config)
            setEditing(null)
          }}
        />
      ) : null}
    </section>
  )
}
