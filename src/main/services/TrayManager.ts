import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { logger } from '../../shared/logger'
import { SettingsManager } from './SettingsManager'

export function getAppIconPath(): string {
  const isWin = process.platform === 'win32'
  const iconFilename = isWin ? 'icon.ico' : 'icon.png'

  const candidates: string[] = []

  try {
    if (app?.getAppPath) {
      candidates.push(path.join(app.getAppPath(), 'resources', iconFilename))
      candidates.push(path.join(app.getAppPath(), 'resources', 'icon.png'))
      candidates.push(path.join(app.getAppPath(), 'build', iconFilename))
    }
  } catch {
    // Ignore fallback
  }

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'resources', iconFilename))
    candidates.push(path.join(process.resourcesPath, 'resources', 'icon.png'))
  }

  candidates.push(path.resolve(process.cwd(), 'resources', iconFilename))
  candidates.push(path.resolve(process.cwd(), 'resources', 'icon.png'))

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return candidates[0] || path.resolve(process.cwd(), 'resources', 'icon.png')
}

export class TrayManager {
  private static instance: TrayManager | null = null
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null
  private isQuitting: boolean = false

  public static getInstance(): TrayManager {
    if (!TrayManager.instance) {
      TrayManager.instance = new TrayManager()
    }
    return TrayManager.instance
  }

  public init(window: BrowserWindow): void {
    this.mainWindow = window

    if (this.tray && !this.tray.isDestroyed()) {
      return
    }

    try {
      const iconPath = getAppIconPath()
      let icon = nativeImage.createFromPath(iconPath)
      if (icon.isEmpty() && process.platform === 'win32') {
        // Fallback to png if ico failed to load
        const pngFallback = iconPath.replace('.ico', '.png')
        if (fs.existsSync(pngFallback)) {
          icon = nativeImage.createFromPath(pngFallback)
        }
      }

      this.tray = new Tray(icon)
      this.tray.setToolTip('Udeler Reborn - Multi-Platform Course Downloader')

      this.updateContextMenu()

      this.tray.on('click', () => {
        this.showWindow()
      })

      this.tray.on('double-click', () => {
        this.showWindow()
      })

      logger.info('TRAY', 'System tray icon initialized successfully')
    } catch (err) {
      logger.error('TRAY', `Failed to initialize system tray: ${String(err)}`)
    }
  }

  public setWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  public showWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    const iconPath = getAppIconPath()
    const appIcon = nativeImage.createFromPath(iconPath)
    const validIcon = !appIcon.isEmpty() ? appIcon : iconPath

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore()
    }

    if (!this.mainWindow.isVisible()) {
      this.mainWindow.show()
    }

    this.mainWindow.focus()

    // Explicitly re-assert the window and taskbar icon once visible
    if (validIcon) {
      this.mainWindow.setIcon(validIcon)
    }

    // Windows Explorer registers/refreshes the taskbar item asynchronously.
    // Re-applying the icon on the next event loop tick prevents Windows from falling back to electron.exe.
    setTimeout(() => {
      if (this.mainWindow && !this.mainWindow.isDestroyed() && validIcon) {
        this.mainWindow.setIcon(validIcon)
      }
    }, 50)
  }

  public hideWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.hide()
    }
  }

  public isQuittingApp(): boolean {
    return this.isQuitting
  }

  public setQuitting(quitting: boolean): void {
    this.isQuitting = quitting
  }

  public updateContextMenu(): void {
    if (!this.tray || this.tray.isDestroyed()) {
      return
    }

    const settings = SettingsManager.getInstance().getSettings()

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Udeler',
        click: (): void => {
          this.showWindow()
        }
      },
      { type: 'separator' },
      {
        label: 'Close to Tray',
        type: 'checkbox',
        checked: settings.closeToTray,
        click: (menuItem): void => {
          SettingsManager.getInstance().updateSettings({ closeToTray: menuItem.checked })
        }
      },
      {
        label: 'Minimize to Tray',
        type: 'checkbox',
        checked: settings.minimizeToTray,
        click: (menuItem): void => {
          SettingsManager.getInstance().updateSettings({ minimizeToTray: menuItem.checked })
        }
      },
      {
        label: 'Start with Windows',
        type: 'checkbox',
        checked: settings.startOnBoot,
        click: (menuItem): void => {
          SettingsManager.getInstance().updateSettings({ startOnBoot: menuItem.checked })
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Udeler',
        click: (): void => {
          this.isQuitting = true
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  public destroy(): void {
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
