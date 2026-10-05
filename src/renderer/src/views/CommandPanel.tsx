import { useState } from 'react'
import { Check, Send, TriangleAlert, X } from 'lucide-react'
import { elementType, integerRange, isArrayType, parseCommandValue } from '@shared/command'
import { commandTopic } from '@shared/topic'
import { SPARKPLUG_NAMESPACE, type SpValue } from '@shared/types'
import { ConnectionChip, TypeBadge } from '../components/badges'
import { Field } from '../components/Field'
import { Toggle } from '../components/Toggle'
import { editableValue, engUnit, formatTime, formatValue, plural } from '../format'
import { store } from '../store'
import type { Leaf, TreeItem } from '../tree'

const SEPARATED = 'separados por coma, espacio o salto de línea'

/** Como se escribe un valor del tipo de dato de la metrica */
function valueHint(type: string): string {
  const element = elementType(type)
  const range = integerRange(type)
  const many = isArrayType(type)
  if (element === 'DateTime') {
    return many
      ? 'Fechas (AAAA-MM-DD HH:MM:SS) o milisegundos desde 1970, una por línea o separadas por coma.'
      : 'Fecha y hora local (AAAA-MM-DD HH:MM:SS) o milisegundos desde 1970.'
  }
  if (range) {
    return many
      ? `Enteros de ${range[0]} a ${range[1]}, ${SEPARATED}.`
      : `Entero de ${range[0]} a ${range[1]}.`
  }
  if (element === 'Float' || element === 'Double') {
    return many
      ? `Números con punto decimal, NaN, Infinity o -Infinity, ${SEPARATED}.`
      : 'Número con punto decimal. También NaN, -Infinity e Infinity.'
  }
  if (element === 'Boolean') return many ? `true o false, ${SEPARATED}.` : ''
  return many ? 'Un texto por línea.' : ''
}

/**
 * Panel para cambiarle el valor a la metrica elegida en el arbol. El comando sale
 * como NCMD o DCMD; el arbol recien muestra el valor nuevo cuando el nodo lo publica.
 */
export function CommandPanel({
  item,
  leaf,
  onClose
}: {
  item: TreeItem
  leaf: Leaf
  onClose: () => void
}): React.JSX.Element | null {
  const [text, setText] = useState(() => editableValue(leaf.type, leaf.value))
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ at: number; error?: string } | null>(null)

  const { connection, metric, edgeNode: node, owner } = item
  if (!metric || !node || !owner) return null

  const { type } = leaf
  const device = owner === node ? undefined : owner.id
  const kind = device === undefined ? 'NCMD' : 'DCMD'
  const many = isArrayType(type)
  const parsed = parseCommandValue(type, text)
  const connected = store.status(connection.id)?.state === 'connected'
  const unit = engUnit(leaf.properties)
  const count =
    many && parsed.error === undefined
      ? ` · ${plural((parsed.value as SpValue[]).length, 'elemento')}`
      : ''

  const edit = (next: string): void => {
    setText(next)
    setResult(null)
  }

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (parsed.error !== undefined || !connected || sending) return
    setSending(true)
    let error: string | null
    try {
      error = await window.api.sendCommand({
        connectionId: connection.id,
        group: node.group,
        node: node.id,
        device,
        metric: metric.name,
        path: item.path,
        type,
        value: parsed.value
      })
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure)
    }
    setSending(false)
    setResult({ at: Date.now(), error: error ?? undefined })
  }

  return (
    <aside className="detail">
      <header className="detail-header">
        <TypeBadge kind={kind} />
        <h2>Enviar comando</h2>
        <button className="icon-button" onClick={onClose} title="Cerrar">
          <X size={16} />
        </button>
      </header>
      <form className="detail-body" onSubmit={submit}>
        <dl className="detail-facts">
          <dt>Conexión</dt>
          <dd>
            <ConnectionChip connection={connection} />
          </dd>
          <dt>Grupo</dt>
          <dd>{node.group}</dd>
          <dt>Nodo</dt>
          <dd>{node.id}</dd>
          {device !== undefined ? (
            <>
              <dt>Device</dt>
              <dd>{device}</dd>
            </>
          ) : null}
          <dt>Métrica</dt>
          <dd>{[metric.name, ...(item.path ?? [])].join(' › ')}</dd>
          <dt>Tipo</dt>
          <dd>{type}</dd>
          <dt>Valor actual</dt>
          <dd className="mono">
            {formatValue(type, leaf.value)}
            {unit ? ` ${unit}` : ''}
          </dd>
          <dt>Tópico</dt>
          <dd className="mono">
            {commandTopic(node.namespace || SPARKPLUG_NAMESPACE, node.group, node.id, device)}
          </dd>
        </dl>

        {!connected ? (
          <div className="notice notice-warn">
            <TriangleAlert size={15} />
            <span>La conexión no está activa: no se puede enviar el comando.</span>
          </div>
        ) : owner.status === 'offline' ? (
          <div className="notice notice-warn">
            <TriangleAlert size={15} />
            <span>
              El {device === undefined ? 'nodo' : 'device'} está offline: lo más probable es que el
              comando no le llegue.
            </span>
          </div>
        ) : null}

        {type === 'Boolean' ? (
          <div className="field">
            <span className="field-label">Nuevo valor</span>
            <Toggle
              checked={text === 'true'}
              onChange={(checked) => edit(String(checked))}
              label={text === 'true' ? 'true' : 'false'}
            />
          </div>
        ) : (
          <Field label={`Nuevo valor${count}`} hint={valueHint(type)} error={parsed.error}>
            {many || type === 'Text' ? (
              <textarea
                value={text}
                rows={many ? 7 : 4}
                spellCheck={false}
                autoFocus
                onChange={(e) => edit(e.target.value)}
              />
            ) : (
              <input
                value={text}
                spellCheck={false}
                autoFocus
                onChange={(e) => edit(e.target.value)}
              />
            )}
          </Field>
        )}

        <div className="command-actions">
          <button
            type="submit"
            className="button button-primary"
            disabled={!connected || sending || parsed.error !== undefined}
          >
            <Send size={14} /> Enviar {kind}
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => edit(editableValue(type, leaf.value))}
          >
            Cargar el valor actual
          </button>
        </div>

        {result?.error ? (
          <div className="notice notice-error">
            <TriangleAlert size={15} />
            <span>No se envió: {result.error}</span>
          </div>
        ) : result ? (
          <p className="command-sent">
            <Check size={14} />
            <span>
              Enviado a las {formatTime(result.at)}. El árbol muestra el valor nuevo cuando el nodo
              lo publica.
            </span>
          </p>
        ) : null}
      </form>
    </aside>
  )
}
