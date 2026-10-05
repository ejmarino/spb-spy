import { app, BrowserWindow, ipcMain } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { normalizeSettings, validateSettings } from '@shared/settings'
import type { AppSettings } from '@shared/types'

/** Configuracion de la app guardada en un JSON dentro de la carpeta de datos del usuario */
export class SettingsStore {
  private readonly file = join(app.getPath('userData'), 'settings.json')
  private settings: AppSettings
  /** Momento de la ultima busqueda de actualizaciones, manual o automatica */
  private lastCheck: number
  private readonly listeners = new Set<(settings: AppSettings) => void>()

  constructor() {
    const stored = this.read()
    this.settings = normalizeSettings(stored)
    this.lastCheck = typeof stored.lastUpdateCheck === 'number' ? stored.lastUpdateCheck : 0
  }

  registerIpc(): void {
    ipcMain.handle('settings:get', () => this.settings)
    ipcMain.handle('settings:set', (_, changes: Partial<AppSettings>) => this.set(changes))
  }

  get current(): AppSettings {
    return this.settings
  }

  get lastUpdateCheck(): number {
    return this.lastCheck
  }

  set lastUpdateCheck(time: number) {
    this.lastCheck = time
    this.save()
  }

  /** Avisa cada vez que cambia una opcion */
  onChange(listener: (settings: AppSettings) => void): void {
    this.listeners.add(listener)
  }

  private set(changes: Partial<AppSettings>): AppSettings {
    const errors = validateSettings(changes)
    if (errors.length) throw new Error(errors.join('. '))

    const { updateFrequency, maxEvents } = { ...this.settings, ...changes }
    this.settings = { updateFrequency, maxEvents }
    this.save()
    for (const listener of this.listeners) listener(this.settings)
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('settings:changed', this.settings)
    }
    return this.settings
  }

  private read(): Record<string, unknown> {
    if (!existsSync(this.file)) return {}
    try {
      const stored: unknown = JSON.parse(readFileSync(this.file, 'utf8'))
      return stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {}
    } catch (error) {
      console.error(`No se pudo leer ${this.file}`, error)
      return {}
    }
  }

  private save(): void {
    const stored = { ...this.settings, lastUpdateCheck: this.lastCheck }
    writeFileSync(this.file, JSON.stringify(stored, null, 2))
  }
}
