import { BrowserWindow, ipcMain } from 'electron'
import { normalizeConnection, validateConnection } from '@shared/connection'
import { applyEvent, serializeModel } from '@shared/model'
import type {
  ConnectionConfig,
  ConnectionStatus,
  MetricCommand,
  NewEvent,
  Snapshot,
  SpEvent
} from '@shared/types'
import type { ConnectionStore } from '../store'
import { SparkplugSession } from './session'

const MAX_EVENTS = 5_000
/** Los eventos se mandan al renderer agrupados para no saturar el IPC */
const FLUSH_MS = 100

/** Dueño de las sesiones MQTT: las crea, junta sus eventos y los reparte a las ventanas */
export class SparkplugManager {
  private configs: ConnectionConfig[]
  private readonly sessions = new Map<string, SparkplugSession>()
  private readonly statuses = new Map<string, ConnectionStatus>()
  private recent: SpEvent[] = []
  private pending: SpEvent[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private lastEventId = 0

  constructor(private readonly store: ConnectionStore) {
    this.configs = store.load()
  }

  registerIpc(): void {
    ipcMain.handle('connections:list', () => this.configs)
    ipcMain.handle('connections:save', (_, config: ConnectionConfig) => this.save(config))
    ipcMain.handle('connections:delete', (_, id: string) => this.remove(id))
    ipcMain.handle('connections:connect', (_, id: string) => this.connect(id))
    ipcMain.handle('connections:disconnect', (_, id: string) => this.sessions.get(id)?.stop())
    ipcMain.handle('sparkplug:rebirth', (_, id: string, group: string, node: string) =>
      this.sessions.get(id)?.requestRebirth(group, node)
    )
    ipcMain.handle('sparkplug:command', (_, command: MetricCommand) => {
      const session = this.sessions.get(command.connectionId)
      return session ? session.sendCommand(command) : 'La conexión no está activa'
    })
    ipcMain.handle('sparkplug:clear-events', () => {
      this.recent = []
    })
    ipcMain.handle('sparkplug:snapshot', () => this.snapshot())
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.sessions.values()].map((session) => session.stop()))
  }

  private snapshot(): Snapshot {
    return {
      connections: this.configs,
      statuses: [...this.statuses.values()],
      models: [...this.sessions].map(([connectionId, session]) => ({
        connectionId,
        nodes: serializeModel(session.model)
      })),
      events: this.recent,
      lastEventId: this.lastEventId
    }
  }

  private async save(raw: ConnectionConfig): Promise<ConnectionConfig[]> {
    const config = normalizeConnection(raw)
    const errors = Object.values(validateConnection(config))
    if (errors.length) throw new Error(errors.join('. '))

    const index = this.configs.findIndex((c) => c.id === config.id)
    if (index < 0) this.configs = [...this.configs, config]
    else this.configs = this.configs.map((c) => (c.id === config.id ? config : c))
    this.store.save(this.configs)

    // una sesion abierta se rearma con la configuracion nueva y arranca sin datos viejos
    const previous = this.sessions.get(config.id)
    if (previous) {
      const wasActive = previous.active
      await previous.stop()
      this.sessions.delete(config.id)
      this.push({
        connectionId: config.id,
        receivedAt: Date.now(),
        kind: 'SYSTEM',
        level: 'info',
        text: 'Se modificó la conexión: se reinician sus datos',
        link: 'reset'
      })
      if (wasActive) this.connect(config.id)
    }
    return this.configs
  }

  private async remove(id: string): Promise<ConnectionConfig[]> {
    await this.sessions.get(id)?.stop()
    this.sessions.delete(id)
    this.statuses.delete(id)
    this.configs = this.configs.filter((c) => c.id !== id)
    this.recent = this.recent.filter((event) => event.connectionId !== id)
    this.pending = this.pending.filter((event) => event.connectionId !== id)
    this.store.save(this.configs)
    return this.configs
  }

  private connect(id: string): void {
    const config = this.configs.find((c) => c.id === id)
    if (!config) return
    let session = this.sessions.get(id)
    if (!session) {
      session = new SparkplugSession(config, {
        emit: (event) => this.push(event),
        status: (state, error) => {
          const status: ConnectionStatus = { id, state, since: Date.now(), error }
          this.statuses.set(id, status)
          this.broadcast('sparkplug:status', status)
        }
      })
      this.sessions.set(id, session)
    }
    session.start()
  }

  private push(event: NewEvent): void {
    const full: SpEvent = { ...event, id: ++this.lastEventId }
    const session = this.sessions.get(full.connectionId)
    if (session) applyEvent(session.model, full)
    this.recent.push(full)
    if (this.recent.length > MAX_EVENTS * 1.2) this.recent = this.recent.slice(-MAX_EVENTS)
    this.pending.push(full)
    this.flushTimer ??= setTimeout(() => {
      this.flushTimer = null
      const batch = this.pending
      this.pending = []
      if (batch.length) this.broadcast('sparkplug:batch', batch)
    }, FLUSH_MS)
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload)
    }
  }
}
