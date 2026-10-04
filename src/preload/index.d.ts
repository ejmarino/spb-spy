import { ElectronAPI } from '@electron-toolkit/preload'
import type { SpbApi } from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: SpbApi
  }
}
