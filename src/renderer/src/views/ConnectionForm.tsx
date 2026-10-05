import { useState } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import {
  CONNECTION_COLORS,
  normalizeConnection,
  topicWarning,
  validateConnection,
  type ConnectionErrors
} from '@shared/connection'
import { DEFAULT_TOPIC, type ConnectionConfig, type RebirthPolicy } from '@shared/types'
import { Toggle } from '../components/Toggle'

interface ConnectionFormProps {
  initial: ConnectionConfig
  isNew: boolean
  onSave: (config: ConnectionConfig) => Promise<void>
  onCancel: () => void
}

const REBIRTH_OPTIONS: { value: RebirthPolicy; label: string }[] = [
  { value: 'missing-birth', label: 'Si falta el BIRTH o hay un salto de secuencia' },
  { value: 'alias', label: 'Solo si llegan alias que no se pueden resolver' },
  { value: 'never', label: 'Nunca' }
]

function Field({
  label,
  hint,
  error,
  children
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className={`field${error ? ' has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
      {!error && hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function ConnectionForm({
  initial,
  isNew,
  onSave,
  onCancel
}: ConnectionFormProps): React.JSX.Element {
  const [draft, setDraft] = useState(initial)
  const [port, setPort] = useState(String(initial.port))
  const [cooldown, setCooldown] = useState(String(initial.rebirthCooldown))
  const [errors, setErrors] = useState<ConnectionErrors>({})
  const [failure, setFailure] = useState('')
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof ConnectionConfig>(key: K, value: ConnectionConfig[K]): void => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const setTls = (tls: boolean): void => {
    set('tls', tls)
    // acompaña el cambio con el puerto habitual, salvo que el usuario haya puesto otro
    if (tls && port === '1883') setPort('8883')
    if (!tls && port === '8883') setPort('1883')
  }

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    const config = normalizeConnection({
      ...draft,
      port: port.trim() === '' ? NaN : Number(port),
      rebirthCooldown: Number(cooldown.replace(',', '.'))
    })
    const found = validateConnection(config)
    if (!/^\d+$/.test(port.trim())) found.port = 'Puerto entre 1 y 65535'
    if (cooldown.trim() === '') found.rebirthCooldown = 'Entre 1 y 3600 segundos'
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    setFailure('')
    try {
      await onSave(config)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error))
      setSaving(false)
    }
  }

  const warning = topicWarning(draft.topic.trim())

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="modal" onSubmit={submit} noValidate>
        <header className="modal-header">
          <h2>{isNew ? 'Nueva conexión' : 'Editar conexión'}</h2>
          <button type="button" className="icon-button" onClick={onCancel} title="Cerrar">
            <X size={16} />
          </button>
        </header>

        <div className="modal-body">
          <div className="field-row">
            <Field label="Nombre" hint="Para reconocerla en eventos y árbol">
              <input
                autoFocus
                value={draft.name}
                placeholder={draft.host || 'Planta norte'}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <div className="field field-narrow">
              <span className="field-label">Color</span>
              <div className="swatches">
                {CONNECTION_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`swatch${draft.color === color ? ' is-selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => set('color', color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="field-row">
            <Field label="Host" error={errors.host}>
              <input
                value={draft.host}
                placeholder="broker.ejemplo.com"
                spellCheck={false}
                onChange={(e) => set('host', e.target.value)}
              />
            </Field>
            <Field label="Puerto" error={errors.port}>
              <input
                className="input-short"
                value={port}
                inputMode="numeric"
                onChange={(e) => setPort(e.target.value)}
              />
            </Field>
          </div>

          <div className="field-row">
            <Toggle checked={draft.tls} onChange={setTls} label="TLS" hint="Conecta por mqtts://" />
            {draft.tls ? (
              <Toggle
                checked={draft.rejectUnauthorized}
                onChange={(checked) => set('rejectUnauthorized', checked)}
                label="Verificar certificado"
                hint="Desactivalo para certificados autofirmados"
              />
            ) : null}
          </div>

          <div className="field-row">
            <Field label="Usuario">
              <input
                value={draft.username}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => set('username', e.target.value)}
              />
            </Field>
            <Field label="Contraseña">
              <input
                type="password"
                value={draft.password}
                autoComplete="off"
                onChange={(e) => set('password', e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Nombre de cliente"
            hint="Client ID de MQTT. Si la app se anuncia como host, también es su Host ID"
            error={errors.clientId}
          >
            <input
              value={draft.clientId}
              spellCheck={false}
              onChange={(e) => set('clientId', e.target.value)}
            />
          </Field>

          <Toggle
            checked={draft.announceHost}
            onChange={(checked) => set('announceHost', checked)}
            label="Anunciarse como host"
            hint="Publica el STATE de la app en spBv1.0/STATE/… como pide la norma. Desactivado, y con el rebirth en Nunca, la app solo escucha y no publica nada en el broker"
          />

          <Field label="Tópico a escuchar" error={errors.topic}>
            <input
              value={draft.topic}
              spellCheck={false}
              placeholder={DEFAULT_TOPIC}
              onChange={(e) => set('topic', e.target.value)}
            />
          </Field>
          {warning && !errors.topic ? (
            <div className="notice notice-warn">
              <TriangleAlert size={15} />
              <span>{warning}</span>
            </div>
          ) : null}

          <Toggle
            checked={draft.sparkplugAware}
            onChange={(checked) => set('sparkplugAware', checked)}
            label="El broker es Sparkplug Aware"
            hint="Lee los BIRTH que el broker guarda en $sparkplug/certificates, así resuelve los alias sin pedir rebirth"
          />

          <div className="field-row">
            <Field
              label="Pedir rebirth"
              hint={
                draft.announceHost
                  ? 'Antes de pedirlo la app se anuncia como host y espera unos segundos a que los nodos publiquen su BIRTH solos'
                  : 'Antes de pedirlo la app espera unos segundos después de conectar'
              }
            >
              <select
                value={draft.rebirthPolicy}
                onChange={(e) => set('rebirthPolicy', e.target.value as RebirthPolicy)}
              >
                {REBIRTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Espera entre rebirths (s)"
              hint="Mínimo entre dos pedidos al mismo nodo"
              error={errors.rebirthCooldown}
            >
              <input
                className="input-short"
                value={cooldown}
                inputMode="decimal"
                disabled={draft.rebirthPolicy === 'never'}
                onChange={(e) => setCooldown(e.target.value)}
              />
            </Field>
          </div>

          {failure ? (
            <div className="notice notice-error">
              <TriangleAlert size={15} />
              <span>{failure}</span>
            </div>
          ) : null}
        </div>

        <footer className="modal-footer">
          <button type="button" className="button" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="button button-primary" disabled={saving}>
            {isNew ? 'Crear conexión' : 'Guardar'}
          </button>
        </footer>
      </form>
    </div>
  )
}
