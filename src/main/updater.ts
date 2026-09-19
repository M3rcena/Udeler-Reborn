import { is } from '@electron-toolkit/utils'
import electron from 'electron'
import { autoUpdater } from 'electron-updater'
import { logger } from '../shared/logger'
import type { UpdaterStatusPayload } from '../shared/types'

const { app, dialog, ipcMain } = electron

export class AppUpdater {
  private window: electron.BrowserWindow | null = null

  constructor() {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    this.registerEvents()
  }

  public setWindow(win: electron.BrowserWindow): void {
    this.window = win
  }

  public sendStatus(payload: UpdaterStatusPayload): void {
    logger.info(
      'UPDATER',
      `Status transition: ${payload.phase}`,
      payload.version ? { version: payload.version } : undefined
    )
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('updater:status', payload)
    }
  }

  private registerEvents(): void {
    autoUpdater.on('checking-for-update', () => {
      this.sendStatus({ phase: 'checking' })
    })

    autoUpdater.on('update-available', (info) => {
      this.sendStatus({ phase: 'available', version: info.version })
    })

    autoUpdater.on('update-not-available', () => {
      this.sendStatus({ phase: 'not-available' })
    })

    autoUpdater.on('error', (err: Error) => {
      logger.error('UPDATER', `Update failed: ${err.message}`)
      this.sendStatus({ phase: 'error', error: err.message })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.sendStatus({
        phase: 'downloading',
        progress: {
          percent: Math.round(progress.percent),
          bytesPerSecond: progress.bytesPerSecond,
          transferred: progress.transferred,
          total: progress.total
        }
      })
    })

    autoUpdater.on('update-downloaded', () => {
      this.sendStatus({ phase: 'ready' })
      setTimeout(() => {
        autoUpdater.quitAndInstall(false, true)
      }, 1500)
    })
  }

  public checkForUpdates(): void {
    if (is.dev) {
      logger.info('UPDATER', 'Dev environment: running simulated check')
      this.sendStatus({ phase: 'checking' })
      setTimeout(() => {
        this.sendStatus({ phase: 'not-available' })
      }, 1800)
      return
    }

    autoUpdater.checkForUpdates().catch((err: Error) => {
      logger.error('UPDATER', `Check failed: ${err.message}`)
      this.sendStatus({ phase: 'error', error: err.message })
    })
  }
}

export function registerUpdaterIpc(updater: AppUpdater): void {
  ipcMain.handle('updater:check', () => {
    updater.checkForUpdates()
  })

  ipcMain.handle('app:version', () => {
    return {
      version: app.getVersion(),
      platform: process.platform
    }
  })

  ipcMain.handle('export-debug-logs', async () => {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Debug Logs',
      defaultPath: `udeler-debug-${new Date().toISOString().slice(0, 10)}.log`,
      filters: [{ name: 'Log Files', extensions: ['log'] }]
    })

    if (!filePath) return false
    return logger.exportLogs(filePath)
  })
}
