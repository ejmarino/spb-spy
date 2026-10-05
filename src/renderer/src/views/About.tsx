import { Radar, TriangleAlert, X } from 'lucide-react'
import type { UpdateStatus } from '@shared/types'
import { Toggle } from '../components/Toggle'
import { store, useStoreVersion } from '../store'

const REPO_URL = 'https://github.com/ejmarino/spb-spy'

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
      Buscar actualizaciones
    </button>
  )
}

export function About({ onClose }: { onClose: () => void }): React.JSX.Element {
  useStoreVersion()
  const { electron, chrome, node } = window.electron.process.versions
  const update = store.update

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-about">
        <header className="modal-header">
          <h2>Acerca de</h2>
          <button type="button" className="icon-button" onClick={onClose} title="Cerrar">
            <X size={16} />
          </button>
        </header>

        <div className="modal-body">
          <div className="about-brand">
            <Radar size={28} />
            <div>
              <strong>SpbSpy</strong>
              <span>Visor de tráfico Sparkplug B sobre MQTT</span>
            </div>
          </div>

          <dl className="about-details">
            <dt>Versión</dt>
            <dd>{__APP_VERSION__}</dd>
            <dt>Sitio</dt>
            <dd>
              {/* El proceso principal abre los enlaces en el navegador del sistema */}
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                {REPO_URL}
              </a>
            </dd>
            <dt>Entorno</dt>
            <dd>
              Electron {electron} · Chromium {chrome} · Node {node}
            </dd>
          </dl>

          <section className="about-updates">
            <Toggle
              checked={update.autoCheck}
              onChange={(enabled) => store.setAutoUpdateCheck(enabled)}
              label="Buscar actualizaciones automáticamente"
              hint="Una vez por día, en los releases de GitHub"
            />
            <div className="about-update-row">
              <span className="about-update-message">{updateMessage(update)}</span>
              <UpdateAction {...update} />
            </div>
            {update.state === 'error' ? (
              <div className="notice notice-error">
                <TriangleAlert size={14} />
                <span>No se pudo completar: {update.error}</span>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}
