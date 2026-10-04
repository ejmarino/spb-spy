import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ConnectionStatus, SpbApi, SpEvent } from '@shared/types'

function listen<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_: Electron.IpcRendererEvent, payload: T): void => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

// Custom APIs for renderer
const api: SpbApi = {
  listConnections: () => ipcRenderer.invoke('connections:list'),
  saveConnection: (config) => ipcRenderer.invoke('connections:save', config),
  deleteConnection: (id) => ipcRenderer.invoke('connections:delete', id),
  connect: (id) => ipcRenderer.invoke('connections:connect', id),
  disconnect: (id) => ipcRenderer.invoke('connections:disconnect', id),
  requestRebirth: (connectionId, group, node) =>
    ipcRenderer.invoke('sparkplug:rebirth', connectionId, group, node),
  clearEvents: () => ipcRenderer.invoke('sparkplug:clear-events'),
  getSnapshot: () => ipcRenderer.invoke('sparkplug:snapshot'),
  onBatch: (callback) => listen<SpEvent[]>('sparkplug:batch', callback),
  onStatus: (callback) => listen<ConnectionStatus>('sparkplug:status', callback)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
