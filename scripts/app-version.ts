import { versionFromGitTag } from 'absolute-version'

/**
 * Version de la app segun los tags de git (vX.Y.Z), calculada con
 * absolute-version. La consultan electron-vite, para dejarla fija en el
 * codigo, y electron-builder, para los paquetes; la de package.json es solo
 * un relleno.
 */
export function appVersion(): string {
  let version: string
  try {
    version = versionFromGitTag()
  } catch {
    // Fuera de un repositorio git (por ejemplo, el codigo bajado como zip)
    return '0.0.0-sin-git'
  }
  // Sin ningun tag de version en el historial, absolute-version arma la
  // version a partir del hash del commit, que no es semver valido
  return /^\d+\.\d+\.\d+/.test(version) ? version : `0.0.0-${version}`
}
