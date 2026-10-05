import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { updateCheckDue } from '@shared/settings'
import type { UpdateStatus } from '@shared/types'
import type { SettingsStore } from './settings'

/** Cada cuanto se revisa si ya toca la busqueda automatica */
const TICK_MS = 60 * 60 * 1000
/** Espera despues del arranque antes de la primera busqueda automatica */
const STARTUP_DELAY_MS = 10_000

/**
 * Solo se actualiza la app instalada y en una version publicada: las versiones
 * intermedias (con sufijo) no se corresponden con ningun release.
 */
function canUpdate(): boolean {
  return app.isPackaged && !app.getVersion().includes('-')
}

/**
 * Busca versiones nuevas en los releases de GitHub con electron-updater. La
 * descarga y la instalacion se hacen recien cuando el usuario las pide.
 */
export class Updater {
  private status: UpdateStatus = { state: canUpdate() ? 'idle' : 'unsupported' }
  /** La busqueda en curso la pidio el usuario: si falla, se le muestra el error */
  private manual = false

  constructor(private readonly settings: SettingsStore) {}

  start(): void {
    ipcMain.handle('updates:status', () => this.status)
    ipcMain.handle('updates:check', () => this.check(true))
    ipcMain.handle('updates:download', () => this.download())
    ipcMain.handle('updates:install', () => this.install())
    if (this.status.state === 'unsupported') return

    autoUpdater.autoDownload = false
    autoUpdater.on('checking-for-update', () => this.update({ state: 'checking' }))
    autoUpdater.on('update-available', (info) =>
      this.update({ state: 'available', version: info.version })
    )
    autoUpdater.on('update-not-available', () => this.update({ state: 'up-to-date' }))
    autoUpdater.on('download-progress', (progress) =>
      this.update({
        state: 'downloading',
        version: this.status.version,
        percent: Math.round(progress.percent)
      })
    )
    autoUpdater.on('update-downloaded', (info) =>
      this.update({ state: 'downloaded', version: info.version })
    )
    autoUpdater.on('error', (error) => this.fail(error))

    setTimeout(() => this.autoCheck(), STARTUP_DELAY_MS)
    setInterval(() => this.autoCheck(), TICK_MS)
  }

  /** Lanza la busqueda si ya paso el intervalo de la periodicidad elegida y no hay nada en curso */
  private autoCheck(): void {
    const { updateFrequency } = this.settings.current
    const due = updateCheckDue(updateFrequency, this.settings.lastUpdateCheck, Date.now())
    const quiet = ['idle', 'up-to-date', 'error'].includes(this.status.state)
    if (due && quiet) this.check(false)
  }

  private async check(manual: boolean): Promise<void> {
    if (['unsupported', 'checking', 'downloading', 'downloaded'].includes(this.status.state)) return
    this.manual = manual
    this.settings.lastUpdateCheck = Date.now()
    // si falla, el evento 'error' ya dejo el estado como corresponde
    await autoUpdater.checkForUpdates().catch(() => undefined)
  }

  private async download(): Promise<void> {
    if (this.status.state !== 'available') return
    this.update({ state: 'downloading', version: this.status.version, percent: 0 })
    await autoUpdater.downloadUpdate().catch(() => undefined)
  }

  /** Cierra la app, instala la version descargada y la vuelve a abrir */
  private install(): void {
    if (this.status.state === 'downloaded') autoUpdater.quitAndInstall()
  }

  private fail(error: Error): void {
    // una busqueda automatica que falla (por ejemplo, sin red) no molesta al usuario
    if (this.status.state === 'checking' && !this.manual) {
      this.update({ state: 'idle' })
      return
    }
    this.update({ state: 'error', error: error.message.split('\n')[0] })
  }

  private update(status: UpdateStatus): void {
    this.status = status
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('updates:changed', this.status)
    }
  }
}
