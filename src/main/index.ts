import { app, screen, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { SettingsStore } from './settings'
import { SparkplugManager } from './sparkplug/manager'
import { ConnectionStore } from './store'
import { Updater } from './updater'

const WINDOW_WIDTH = 1360
const WINDOW_HEIGHT = 820
/** Lugar que ocupan el marco y la barra de titulo que agrega el sistema */
const FRAME_MARGIN = 40

let manager: SparkplugManager | null = null
let quitting = false

function createWindow(): void {
  // en pantallas chicas (por ejemplo el escritorio noVNC) la ventana arranca maximizada
  const workArea = screen.getPrimaryDisplay().workAreaSize
  const fits = workArea.width >= WINDOW_WIDTH && workArea.height >= WINDOW_HEIGHT + FRAME_MARGIN

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: Math.min(WINDOW_WIDTH, workArea.width),
    height: Math.min(WINDOW_HEIGHT, workArea.height - FRAME_MARGIN),
    minWidth: 940,
    minHeight: 480,
    show: false,
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    if (!fits) mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('ar.horizonbytes.spbspy')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const settings = new SettingsStore()
  settings.registerIpc()
  manager = new SparkplugManager(new ConnectionStore(), settings)
  manager.registerIpc()
  new Updater(settings).start()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Antes de salir cada conexion publica su STATE offline y se desconecta del broker.
app.on('before-quit', (event) => {
  if (quitting || !manager) return
  event.preventDefault()
  quitting = true
  manager.shutdown().finally(() => app.quit())
})
