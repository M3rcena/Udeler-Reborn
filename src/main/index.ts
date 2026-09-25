import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, screen, shell } from 'electron'
import { join } from 'path'
import { AuthManager, registerAuthIpc } from './auth'
import { AppUpdater, registerUpdaterIpc } from './updater'

const updater = new AppUpdater()
const authManager = new AuthManager()

let splashWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 440,
    height: 350,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  updater.setWindow(splashWindow)

  splashWindow.on('ready-to-show', () => {
    splashWindow?.show()
    updater.checkForUpdates()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    splashWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    splashWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus()
    return
  }

  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 680,
    frame: false,
    transparent: false,
    backgroundColor: '#09090e',
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  updater.setWindow(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:state-changed', { isMaximized: true })
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:state-changed', { isMaximized: false })
  })

  const mainUrl =
    is.dev && process.env['ELECTRON_RENDERER_URL']
      ? `${process.env['ELECTRON_RENDERER_URL']}?view=main`
      : join(__dirname, '../renderer/index.html')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(mainUrl)
  } else {
    mainWindow.loadFile(mainUrl, { query: { view: 'main' } })
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.udeler.reborn')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerUpdaterIpc(updater)
  registerAuthIpc(authManager)

  ipcMain.handle('app:resize-to-main', () => {
    createMainWindow()
  })

  /**
   * Handlers for Window Controls
   */
  ipcMain.handle('app:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.minimize()
    }
  })

  ipcMain.handle('app:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      if (!win.isResizable()) {
        win.setResizable(true)
      }
      if (win.isMaximized()) {
        win.unmaximize()
        const [w, h] = win.getSize()
        const primaryDisplay = screen.getPrimaryDisplay()
        if (w >= primaryDisplay.workArea.width && h >= primaryDisplay.workArea.height) {
          win.setSize(1180, 760)
          win.center()
        }
      } else {
        win.maximize()
      }
      return win.isMaximized()
    }
    return false
  })

  ipcMain.handle('app:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })

  ipcMain.handle('app:is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win && !win.isDestroyed() ? win.isMaximized() : false
  })

  createSplashWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createSplashWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
