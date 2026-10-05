import { Radar, X } from 'lucide-react'

const REPO_URL = 'https://github.com/ejmarino/spb-spy'

export function About({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { electron, chrome, node } = window.electron.process.versions

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-about">
        <header className="modal-header">
          <h2>Acerca de {__APP_NAME__}</h2>
          <button type="button" className="icon-button" onClick={onClose} title="Cerrar">
            <X size={16} />
          </button>
        </header>

        <div className="modal-body">
          <div className="about-brand">
            <Radar size={28} />
            <div>
              <strong>{__APP_NAME__}</strong>
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
        </div>
      </div>
    </div>
  )
}
