import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { AuthManager, registerAuthIpc } from './auth'
import { AppUpdater, registerUpdaterIpc } from './updater'

const updater = new AppUpdater()
const authManager = new AuthManager()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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

  updater.setWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    updater.checkForUpdates()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  ipcMain.handle('app:resize-to-main', () => {
    mainWindow.setResizable(true)
    mainWindow.setMinimumSize(960, 680)
    mainWindow.maximize()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.udeler.reborn')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerUpdaterIpc(updater)
  registerAuthIpc(authManager)
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
