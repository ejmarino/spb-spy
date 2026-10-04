import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { normalizeConnection } from '@shared/connection'
import type { ConnectionConfig } from '@shared/types'

type StoredConnection = Omit<ConnectionConfig, 'password'> & {
  password?: string
  /** Contraseña cifrada con el almacen de credenciales del sistema, en base64 */
  passwordEncrypted?: string
}

function canEncrypt(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

/** Lista de conexiones guardada en un JSON dentro de la carpeta de datos del usuario */
export class ConnectionStore {
  private readonly file = join(app.getPath('userData'), 'connections.json')

  load(): ConnectionConfig[] {
    if (!existsSync(this.file)) return []
    try {
      const stored = JSON.parse(readFileSync(this.file, 'utf8')) as StoredConnection[]
      return stored.map(({ passwordEncrypted, ...rest }) => {
        let password = rest.password ?? ''
        if (passwordEncrypted) {
          try {
            password = safeStorage.decryptString(Buffer.from(passwordEncrypted, 'base64'))
          } catch {
            password = ''
          }
        }
        return normalizeConnection({ ...rest, password })
      })
    } catch (error) {
      console.error(`No se pudo leer ${this.file}`, error)
      return []
    }
  }

  save(connections: ConnectionConfig[]): void {
    const encrypt = canEncrypt()
    const stored = connections.map(({ password, ...rest }): StoredConnection => {
      if (!password) return rest
      if (!encrypt) return { ...rest, password }
      return { ...rest, passwordEncrypted: safeStorage.encryptString(password).toString('base64') }
    })
    writeFileSync(this.file, JSON.stringify(stored, null, 2))
  }
}
