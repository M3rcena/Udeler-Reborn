import { is, optimizer } from '@electron-toolkit/utils'
import { CourseItem, PlatformId } from '@shared/types'
import { app, BrowserWindow, ipcMain, nativeImage, screen, shell } from 'electron'
import * as fs from 'node:fs'
import { join } from 'path'
import { AuthManager, registerAuthIpc } from './auth'
import { DiscordRpcManager, registerDiscordIpc } from './services/DiscordRpcManager'
import { NotificationManager } from './services/NotificationManager'
import {
  applyProxySettings,
  registerSettingsIpc,
  SettingsManager
} from './services/SettingsManager'
import { getAppIconPath, TrayManager } from './services/TrayManager'
import { UdemyService } from './services/UdemyService'
import { AppUpdater, registerUpdaterIpc } from './updater'

const updater = new AppUpdater()
const authManager = new AuthManager()
const settingsManager = SettingsManager.getInstance()
const trayManager = TrayManager.getInstance()
const discordRpcManager = DiscordRpcManager.getInstance()

// Set product branding name early
app.name = 'Udeler Reborn'

// Hardware Acceleration must be configured before app is ready
const startupSettings = settingsManager.getSettings()
if (startupSettings.hardwareAcceleration === false) {
  app.disableHardwareAcceleration()
}

// Ensure single instance lock so Jump List tasks activate the running instance
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

function setupTaskbarJumpList(): void {
  if (process.platform !== 'win32') return

  try {
    const iconPath = getAppIconPath()
    const execPath = process.execPath
    const isDev = is.dev
    const appDir = app.getAppPath()

    // Explorer's CWD for JumpList tasks is System32; pass app directory in dev mode
    const makeArgs = (flag: string): string => (isDev ? `"${appDir}" ${flag}` : flag)

    // Clear custom jump list to avoid Windows privacy policy errors with custom categories
    try {
      app.setJumpList(null)
    } catch {
      // Ignore
    }

    // Register user tasks directly (bypasses Windows custom category privacy restrictions)
    app.setUserTasks([
      {
        program: execPath,
        arguments: makeArgs('--platform=udemy'),
        title: 'Udemy',
        description: 'Download courses from Udemy',
        iconPath,
        iconIndex: 0
      },
      {
        program: execPath,
        arguments: makeArgs('--view=downloads'),
        title: 'Downloads',
        description: 'View active downloads',
        iconPath,
        iconIndex: 0
      },
      {
        program: execPath,
        arguments: makeArgs('--view=settings'),
        title: 'Settings',
        description: 'Open app settings',
        iconPath,
        iconIndex: 0
      }
    ])
  } catch (err) {
    console.warn('Could not register Windows Jump List tasks:', err)
  }
}

function applyLoginItemSettings(startOnBoot: boolean): void {
  try {
    if (app && typeof app.setLoginItemSettings === 'function') {
      app.setLoginItemSettings({
        openAtLogin: Boolean(startOnBoot),
        path: process.execPath
      })
    }
  } catch (err) {
    console.error('Failed to apply login item settings:', err)
  }
}

let splashWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null

function createSplashWindow(): void {
  const iconPath = getAppIconPath()
  const appIcon = nativeImage.createFromPath(iconPath)

  splashWindow = new BrowserWindow({
    title: 'Udeler Reborn',
    width: 440,
    height: 350,
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    show: false,
    autoHideMenuBar: true,
    icon: appIcon.isEmpty() ? iconPath : appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (!appIcon.isEmpty()) {
    splashWindow.setIcon(appIcon)
  }

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
    trayManager.showWindow()
    return
  }

  const iconPath = getAppIconPath()
  const appIcon = nativeImage.createFromPath(iconPath)
  const windowIcon = appIcon.isEmpty() ? iconPath : appIcon

  mainWindow = new BrowserWindow({
    title: 'Udeler Reborn',
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 680,
    frame: false,
    transparent: false,
    backgroundColor: '#09090e',
    icon: windowIcon,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (!appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon)
  }

  trayManager.setWindow(mainWindow)

  updater.setWindow(mainWindow)

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    const platformArg = process.argv.find((arg) => arg.startsWith('--platform='))
    const viewArg = process.argv.find((arg) => arg.startsWith('--view='))
    const target: { platform?: string; view?: string } = {}
    if (platformArg) target.platform = platformArg.split('=')[1]
    if (viewArg) target.view = viewArg.split('=')[1]

    if (target.platform || target.view) {
      mainWindow?.webContents.send('jumplist:navigate', target)
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.maximize()
    mainWindow?.show()
    if (!appIcon.isEmpty()) {
      mainWindow?.setIcon(appIcon)
    }

    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
      splashWindow = null
    }
  })

  mainWindow.on('show', () => {
    if (process.platform === 'win32' && !appIcon.isEmpty()) {
      mainWindow?.setIcon(appIcon)
    }
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:state-changed', { isMaximized: true })
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:state-changed', { isMaximized: false })
  })

  mainWindow.on('close', (event) => {
    if (trayManager.isQuittingApp()) return
    const settings = settingsManager.getSettings()
    if (settings.closeToTray) {
      event.preventDefault()
      trayManager.hideWindow()
    }
  })

  mainWindow.on('minimize', () => {
    const settings = settingsManager.getSettings()
    if (settings.minimizeToTray) {
      trayManager.hideWindow()
    }
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
  const appId = 'com.m3rcena.udeler'
  app.name = 'Udeler Reborn'

  // Set Windows AppUserModelId directly so Taskbar and Action Center identify as Udeler Reborn
  if (process.platform === 'win32') {
    app.setAppUserModelId(appId)

    try {
      const programsDir = join(
        app.getPath('appData'),
        'Microsoft',
        'Windows',
        'Start Menu',
        'Programs'
      )
      const shortcutPath = join(programsDir, 'Udeler Reborn.lnk')
      const iconPath = getAppIconPath()

      // Register or update Start Menu shortcut with AppUserModelId and icon for notifications
      shell.writeShortcutLink(shortcutPath, fs.existsSync(shortcutPath) ? 'update' : 'create', {
        target: process.execPath,
        args: is.dev ? `"${app.getAppPath()}"` : '',
        appUserModelId: appId,
        description: 'Udeler Reborn - Multi-Platform Course Downloader',
        icon: iconPath,
        iconIndex: 0
      })
    } catch (err) {
      console.warn('Could not register Start Menu shortcut for AppUserModelId:', err)
    }
  } else {
    app.setAppUserModelId(appId)
  }

  setupTaskbarJumpList()

  app.on('second-instance', (_event, commandLine) => {
    trayManager.showWindow()

    const platformArg = commandLine.find((arg) => arg.startsWith('--platform='))
    const viewArg = commandLine.find((arg) => arg.startsWith('--view='))

    const target: { platform?: string; view?: string } = {}
    if (platformArg) target.platform = platformArg.split('=')[1]
    if (viewArg) target.view = viewArg.split('=')[1]

    if ((target.platform || target.view) && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('jumplist:navigate', target)
    }
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerUpdaterIpc(updater)
  registerAuthIpc(authManager)
  registerSettingsIpc(settingsManager)
  registerDiscordIpc(discordRpcManager)

  trayManager.init(mainWindow || splashWindow!)
  applyLoginItemSettings(startupSettings.startOnBoot)
  applyProxySettings(startupSettings)
  discordRpcManager.applySettings(startupSettings)

  settingsManager.onSettingsChange((settings) => {
    applyLoginItemSettings(settings.startOnBoot)
    trayManager.updateContextMenu()
    applyProxySettings(settings)
    discordRpcManager.applySettings(settings)
  })

  app.on('before-quit', () => {
    trayManager.setQuitting(true)
    discordRpcManager.destroy()
  })

  ipcMain.handle('app:resize-to-main', () => {
    createMainWindow()
  })

  /**
   * Handlers for Window Controls with System Tray support
   */
  ipcMain.handle('app:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && !win.isDestroyed()) {
      const settings = settingsManager.getSettings()
      if (win === mainWindow && settings.minimizeToTray) {
        trayManager.hideWindow()
      } else {
        win.minimize()
      }
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
      const settings = settingsManager.getSettings()
      if (win === mainWindow && settings.closeToTray && !trayManager.isQuittingApp()) {
        trayManager.hideWindow()
      } else {
        win.close()
      }
    }
  })

  ipcMain.handle('app:is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win && !win.isDestroyed() ? win.isMaximized() : false
  })

  /**
   * Handlers for Notifications, Relaunch, and App Lifecycle
   */
  ipcMain.handle(
    'notification:show',
    (_event, payload: { title: string; body: string; force?: boolean }): boolean => {
      return NotificationManager.showNotification(
        payload.title,
        payload.body,
        () => {
          trayManager.showWindow()
        },
        payload.force
      )
    }
  )

  ipcMain.handle('app:relaunch', () => {
    trayManager.setQuitting(true)
    trayManager.destroy()
    discordRpcManager.destroy()

    if (is.dev) {
      app.relaunch({ args: process.argv.slice(1) })
    } else {
      app.relaunch()
    }

    BrowserWindow.getAllWindows().forEach((win) => {
      win.removeAllListeners('close')
      win.destroy()
    })

    app.quit()
  })

  ipcMain.handle('app:get-boot-status', () => {
    try {
      if (app && typeof app.getLoginItemSettings === 'function') {
        return app.getLoginItemSettings().openAtLogin
      }
    } catch {
      // fallback
    }
    return settingsManager.getSettings().startOnBoot
  })

  /**
   * Handlers for Services
   */
  ipcMain.handle('courses:get', async (_event, platformId: PlatformId): Promise<CourseItem[]> => {
    const session = authManager.getSession(platformId)
    if (!session) {
      throw new Error(`No active session found for platform ${platformId}`)
    }

    if (platformId === 'udemy') {
      return UdemyService.fetchEnrolledCourses(session)
    }

    return []
  })

  createSplashWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSplashWindow()
    } else {
      trayManager.showWindow()
    }
  })
})

app.on('window-all-closed', () => {
  const settings = settingsManager.getSettings()
  if (settings.closeToTray && !trayManager.isQuittingApp()) {
    // Keep alive in system tray
    return
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
