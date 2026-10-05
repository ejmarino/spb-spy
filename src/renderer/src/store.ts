import { useSyncExternalStore } from 'react'
import { applyEvent, createModel, deserializeModel, type ConnectionModel } from '@shared/model'
import { DEFAULT_SETTINGS, trimEvents } from '@shared/settings'
import type {
  AppSettings,
  ConnectionConfig,
  ConnectionStatus,
  SpEvent,
  UpdateStatus
} from '@shared/types'

/** Tiempo que dura el resaltado de un valor recien actualizado */
export const FLASH_MS = 1_200

/**
 * Estado de la app en el renderer. Los datos llegan en lotes desde el proceso
 * principal y se guardan en estructuras mutables; los componentes se enteran
 * de los cambios por el numero de version.
 */
class Store {
  connections: ConnectionConfig[] = []
  /** En que anda la busqueda de actualizaciones */
  update: UpdateStatus = { state: 'unsupported' }
  settings: AppSettings = DEFAULT_SETTINGS
  events: SpEvent[] = []
  /** Sube con cada lote de eventos o cambio de estado */
  version = 0
  /** Sube cuando cambia la forma del arbol de datos */
  structure = 0
  /** Momento del ultimo cambio: los componentes lo usan como "ahora" */
  now = Date.now()

  private readonly statuses = new Map<string, ConnectionStatus>()
  private readonly models = new Map<string, ConnectionModel>()
  private readonly listeners = new Set<() => void>()
  private started = false
  private ready = false
  private buffered: SpEvent[] = []
  private lastEventId = 0
  private settleTimer: ReturnType<typeof setTimeout> | null = null

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getVersion = (): number => this.version

  start(): void {
    if (this.started) return
    this.started = true
    window.api.onBatch((events) => {
      if (this.ready) this.apply(events)
      else this.buffered.push(...events)
    })
    window.api.onStatus((status) => {
      this.statuses.set(status.id, status)
      this.notify()
    })
    const setUpdate = (status: UpdateStatus): void => {
      this.update = status
      this.notify()
    }
    window.api.onUpdateStatus(setUpdate)
    window.api.getUpdateStatus().then(setUpdate)
    const setSettings = (settings: AppSettings): void => {
      this.settings = settings
      // si se achico el maximo, lo que sobra se descarta en el momento
      this.events = trimEvents(this.events, settings.maxEvents, true)
      this.notify()
    }
    window.api.onSettings(setSettings)
    window.api.getSettings().then(setSettings)
    window.api.getSnapshot().then((snapshot) => {
      this.connections = snapshot.connections
      for (const status of snapshot.statuses) this.statuses.set(status.id, status)
      for (const { connectionId, nodes } of snapshot.models) {
        this.models.set(connectionId, deserializeModel(nodes))
      }
      this.events = snapshot.events
      this.lastEventId = snapshot.lastEventId
      this.ready = true
      this.structure++
      // lo que llego mientras se pedia la foto inicial puede estar repetido en ella
      const buffered = this.buffered
      this.buffered = []
      this.apply(buffered)
    })
  }

  status(id: string): ConnectionStatus | undefined {
    return this.statuses.get(id)
  }

  model(id: string): ConnectionModel | undefined {
    return this.models.get(id)
  }

  async saveConnection(config: ConnectionConfig): Promise<void> {
    this.setConnections(await window.api.saveConnection(config))
  }

  async deleteConnection(id: string): Promise<void> {
    this.setConnections(await window.api.deleteConnection(id))
  }

  /** El cambio vuelve por `onSettings`, que es quien lo aplica */
  async setSettings(changes: Partial<AppSettings>): Promise<void> {
    await window.api.setSettings(changes)
  }

  clearEvents(): void {
    this.events = []
    window.api.clearEvents()
    this.notify()
  }

  private setConnections(connections: ConnectionConfig[]): void {
    this.connections = connections
    const ids = new Set(connections.map((c) => c.id))
    for (const id of [...this.models.keys()]) if (!ids.has(id)) this.models.delete(id)
    for (const id of [...this.statuses.keys()]) if (!ids.has(id)) this.statuses.delete(id)
    this.events = this.events.filter((event) => ids.has(event.connectionId))
    this.structure++
    this.notify()
  }

  private apply(events: SpEvent[]): void {
    const ids = new Set(this.connections.map((c) => c.id))
    for (const event of events) {
      if (event.id <= this.lastEventId || !ids.has(event.connectionId)) continue
      this.lastEventId = event.id
      let model = this.models.get(event.connectionId)
      if (!model) {
        model = createModel()
        this.models.set(event.connectionId, model)
      }
      const before = model.structure
      applyEvent(model, event)
      if (model.structure !== before) this.structure++
      this.events.push(event)
    }
    this.events = trimEvents(this.events, this.settings.maxEvents)
    this.notify()
    // una pasada mas cuando vence el resaltado, por si no llegan mas eventos
    if (this.settleTimer) clearTimeout(this.settleTimer)
    this.settleTimer = setTimeout(() => this.notify(), FLASH_MS + 100)
  }

  private notify(): void {
    this.version++
    this.now = Date.now()
    for (const listener of this.listeners) listener()
  }
}

export const store = new Store()

/** Suscribe el componente a los cambios del store y devuelve la version actual */
export function useStoreVersion(): number {
  return useSyncExternalStore(store.subscribe, store.getVersion)
}
