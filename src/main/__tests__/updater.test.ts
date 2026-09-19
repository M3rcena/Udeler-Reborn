import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdaterStatusPayload } from '../../shared/types'

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

vi.mock('electron', () => {
  const electronMock = {
    app: {
      getVersion: () => '4.0.0'
    },
    BrowserWindow: class {},
    dialog: {
      showSaveDialog: vi.fn()
    },
    ipcMain: {
      handle: vi.fn()
    }
  }
  return {
    default: electronMock,
    ...electronMock
  }
})

vi.mock('electron-updater', () => {
  return {
    autoUpdater: {
      autoDownload: true,
      autoInstallOnAppQuit: true,
      on: vi.fn(),
      checkForUpdates: vi.fn().mockResolvedValue(null),
      quitAndInstall: vi.fn()
    }
  }
})

import { AppUpdater } from '../updater'

describe('AppUpdater Phase Contract', () => {
  let updater: AppUpdater
  let mockWindow: { isDestroyed: () => boolean; webContents: { send: ReturnType<typeof vi.fn> } }

  beforeEach(() => {
    updater = new AppUpdater()
    mockWindow = {
      isDestroyed: () => false,
      webContents: {
        send: vi.fn()
      }
    }
    updater.setWindow(mockWindow as unknown as import('electron').BrowserWindow)
  })

  it('correctly broadcasts update-available status with version', () => {
    const payload: UpdaterStatusPayload = {
      phase: 'available',
      version: '4.1.0'
    }

    updater.sendStatus(payload)

    expect(mockWindow.webContents.send).toHaveBeenCalledWith('updater:status', payload)
  })

  it('correctly broadcasts download-progress status with throughput metrics', () => {
    const payload: UpdaterStatusPayload = {
      phase: 'downloading',
      progress: {
        percent: 65,
        bytesPerSecond: 5242880,
        transferred: 65000000,
        total: 100000000
      }
    }

    updater.sendStatus(payload)

    expect(mockWindow.webContents.send).toHaveBeenCalledWith('updater:status', payload)
  })

  it('does not crash or dispatch when the target window is destroyed', () => {
    mockWindow.isDestroyed = () => true
    updater.sendStatus({ phase: 'not-available' })

    expect(mockWindow.webContents.send).not.toHaveBeenCalled()
  })
})
