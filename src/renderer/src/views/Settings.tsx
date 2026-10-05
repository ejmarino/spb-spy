import { useState } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import { MAX_EVENTS_RANGE, UPDATE_FREQUENCIES, validateMaxEvents } from '@shared/settings'
import type { UpdateFrequency, UpdateStatus } from '@shared/types'
import { Field } from '../components/Field'
import { store, useStoreVersion } from '../store'

/** Texto que acompaña al boton de actualizaciones, segun en que anda la busqueda */
function updateMessage({ state, version, percent }: UpdateStatus): string {
  switch (state) {
    case 'unsupported':
      return 'Solo disponible en las versiones publicadas de la app instalada.'
    case 'checking':
      return 'Buscando…'
    case 'up-to-date':
      return 'Tenés la última versión.'
    case 'available':
      return `Hay una versión nueva: ${version}.`
    case 'downloading':
      return `Descargando la versión ${version}… ${percent ?? 0} %`
    case 'downloaded':
      return `La versión ${version} está lista. Se instala al reiniciar la app.`
    default:
      return ''
  }
}

function UpdateAction({ state }: UpdateStatus): React.JSX.Element {
  if (state === 'available') {
    return (
      <button className="button button-primary" onClick={() => window.api.downloadUpdate()}>
        Descargar e instalar
      </button>
    )
  }
  if (state === 'downloaded') {
    return (
      <button className="button button-primary" onClick={() => window.api.installUpdate()}>
        Reiniciar e instalar
      </button>
    )
  }
  return (
    <button
      className="button"
      disabled={state === 'unsupported' || state === 'checking' || state === 'downloading'}
      onClick={() => window.api.checkForUpdates()}
    >
      Buscar ahora
    </button>
  )
}

/**
 * El valor se aplica recien al salir del campo o con Enter: aplicarlo con cada
 * tecla recortaria la lista de eventos con los numeros a medio escribir.
 */
function MaxEventsField({ value }: { value: number }): React.JSX.Element {
  const [draft, setDraft] = useState(String(value))
  const [error, setError] = useState<string | null>(null)

  const commit = (): void => {
    const text = draft.trim()
    const next = /^\d+$/.test(text) ? Number(text) : NaN
    const invalid = validateMaxEvents(next)
    setError(invalid)
    if (!invalid && next !== value) store.setSettings({ maxEvents: next })
  }

  return (
    <Field
      label="Máximo de eventos en memoria"
      hint={`Entre ${MAX_EVENTS_RANGE}, sumando todas las conexiones. Más eventos ocupan más memoria; al bajarlo se descartan los más viejos.`}
      error={error ?? undefined}
    >
      <input
        className="input-short"
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setError(null)
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </Field>
  )
}

export function Settings({ onClose }: { onClose: () => void }): React.JSX.Element {
  useStoreVersion()
  const { update, settings } = store

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-settings">
        <header className="modal-header">
          <h2>Configuración</h2>
          <button type="button" className="icon-button" onClick={onClose} title="Cerrar">
            <X size={16} />
          </button>
        </header>

        <div className="modal-body">
          <section className="settings-section">
            <h3>Actualizaciones</h3>
            <Field
              label="Buscar actualizaciones"
              hint="Automáticamente, en los releases de GitHub. Mensual es cada 30 días"
            >
              <select
                className="input-short"
                value={settings.updateFrequency}
                onChange={(e) =>
                  store.setSettings({ updateFrequency: e.target.value as UpdateFrequency })
                }
              >
                {UPDATE_FREQUENCIES.map((frequency) => (
                  <option key={frequency.value} value={frequency.value}>
                    {frequency.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="settings-update-row">
              <span className="settings-update-message">{updateMessage(update)}</span>
              <UpdateAction {...update} />
            </div>
            {update.state === 'error' ? (
              <div className="notice notice-error">
                <TriangleAlert size={14} />
                <span>No se pudo completar: {update.error}</span>
              </div>
            ) : null}
          </section>

          <section className="settings-section">
            <h3>Eventos</h3>
            {/* la clave rearma el campo cuando el valor vigente cambia por fuera */}
            <MaxEventsField key={settings.maxEvents} value={settings.maxEvents} />
          </section>
        </div>
      </div>
    </div>
  )
}
