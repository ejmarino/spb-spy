import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/types'

const DAY_MS = 24 * 60 * 60 * 1000
/** Cada cuanto se revisa si ya toca la busqueda diaria */
const TICK_MS = 60 * 60 * 1000
/** Espera despues del arranque antes de la primera busqueda automatica */
const STARTUP_DELAY_MS = 10_000

interface Settings {
  /** Buscar actualizaciones automaticamente una vez por dia */
  autoUpdateCheck: boolean
  /** Momento de la ultima busqueda, manual o automatica */
  lastUpdateCheck: number
}

const DEFAULT_SETTINGS: Settings = { autoUpdateCheck: true, lastUpdateCheck: 0 }

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
  private readonly file = join(app.getPath('userData'), 'settings.json')
  private readonly settings = this.load()
  private status: UpdateStatus = {
    state: canUpdate() ? 'idle' : 'unsupported',
    autoCheck: this.settings.autoUpdateCheck
  }
  /** La busqueda en curso la pidio el usuario: si falla, se le muestra el error */
  private manual = false

  start(): void {
    ipcMain.handle('updates:status', () => this.status)
    ipcMain.handle('updates:set-auto-check', (_, enabled: boolean) => this.setAutoCheck(enabled))
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

  private setAutoCheck(enabled: boolean): UpdateStatus {
    this.settings.autoUpdateCheck = enabled
    this.save()
    this.update(this.status)
    return this.status
  }

  /** Lanza la busqueda diaria si esta habilitada, ya paso un dia y no hay nada en curso */
  private autoCheck(): void {
    const due = Date.now() - this.settings.lastUpdateCheck >= DAY_MS
    const quiet = ['idle', 'up-to-date', 'error'].includes(this.status.state)
    if (this.settings.autoUpdateCheck && due && quiet) this.check(false)
  }

  private async check(manual: boolean): Promise<void> {
    if (['unsupported', 'checking', 'downloading', 'downloaded'].includes(this.status.state)) return
    this.manual = manual
    this.settings.lastUpdateCheck = Date.now()
    this.save()
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

  private update(status: Omit<UpdateStatus, 'autoCheck'>): void {
    this.status = { ...status, autoCheck: this.settings.autoUpdateCheck }
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('updates:changed', this.status)
    }
  }

  private load(): Settings {
    if (!existsSync(this.file)) return { ...DEFAULT_SETTINGS }
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(this.file, 'utf8')) }
    } catch (error) {
      console.error(`No se pudo leer ${this.file}`, error)
      return { ...DEFAULT_SETTINGS }
    }
  }

  private save(): void {
    writeFileSync(this.file, JSON.stringify(this.settings, null, 2))
  }
}
