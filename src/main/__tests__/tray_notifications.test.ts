import * as os from 'node:os'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { MockNotification, mockNotificationShow } = vi.hoisted(() => {
  const showFn = vi.fn()
  const onFn = vi.fn()
  class MockNotificationClass {
    static isSupported = vi.fn(() => true)
    show = showFn
    on = onFn
  }
  return {
    MockNotification: MockNotificationClass,
    mockNotificationShow: showFn
  }
})

vi.mock('electron', () => {
  const electronMock = {
    app: {
      getAppPath: vi.fn(() => process.cwd()),
      getPath: vi.fn(() => os.tmpdir()),
      setLoginItemSettings: vi.fn(),
      getLoginItemSettings: vi.fn(() => ({ openAtLogin: false }))
    },
    Notification: MockNotification,
    Tray: vi.fn().mockImplementation(() => ({
      setToolTip: vi.fn(),
      setContextMenu: vi.fn(),
      on: vi.fn(),
      destroy: vi.fn(),
      isDestroyed: vi.fn(() => false)
    })),
    Menu: {
      buildFromTemplate: vi.fn((items) => items)
    },
    nativeImage: {
      createFromPath: vi.fn(() => ({ isEmpty: () => false }))
    },
    BrowserWindow: vi.fn(),
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => false),
      encryptString: vi.fn((str: string) => Buffer.from(str)),
      decryptString: vi.fn((buf: Buffer) => buf.toString('utf-8'))
    },
    dialog: {
      showOpenDialog: vi.fn()
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

import { NotificationManager } from '../services/NotificationManager'
import { SettingsManager } from '../services/SettingsManager'
import { getAppIconPath, TrayManager } from '../services/TrayManager'

describe('TrayManager and NotificationManager Backend Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves a valid app icon path', () => {
    const iconPath = getAppIconPath()
    expect(iconPath).toBeDefined()
    expect(iconPath.length).toBeGreaterThan(0)
    expect(iconPath.endsWith('.ico') || iconPath.endsWith('.png')).toBe(true)
  })

  it('respects notifyOnCompletion preference and force flag', () => {
    const settings = SettingsManager.getInstance()
    settings.updateSettings({ notifyOnCompletion: false })

    // When disabled and force is not set, should not show
    const resultDisabled = NotificationManager.showNotification('Test', 'Body', undefined, false)
    expect(resultDisabled).toBe(false)
    expect(mockNotificationShow).not.toHaveBeenCalled()

    // When force=true, test notification bypasses the preference
    const resultForced = NotificationManager.showNotification('Test Force', 'Body', undefined, true)
    expect(resultForced).toBe(true)
    expect(mockNotificationShow).toHaveBeenCalled()

    // When notifyOnCompletion=true, regular notifications work
    settings.updateSettings({ notifyOnCompletion: true })
    const resultEnabled = NotificationManager.showNotification('Test Enabled', 'Body')
    expect(resultEnabled).toBe(true)
  })

  it('initializes TrayManager singleton without throwing', () => {
    const manager = TrayManager.getInstance()
    expect(manager).toBeDefined()
    expect(typeof manager.init).toBe('function')
    expect(typeof manager.showWindow).toBe('function')
  })

  it('manages taskbar and window visibility in showWindow and hideWindow', () => {
    const manager = TrayManager.getInstance()
    const mockWindow = {
      isDestroyed: vi.fn(() => false),
      isMinimized: vi.fn(() => true),
      isVisible: vi.fn(() => false),
      restore: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
      setIcon: vi.fn(),
      setSkipTaskbar: vi.fn(),
      setAppDetails: vi.fn()
    } as unknown as import('electron').BrowserWindow

    manager.setWindow(mockWindow)

    manager.hideWindow()
    expect(mockWindow.hide).toHaveBeenCalled()

    manager.showWindow()
    expect(mockWindow.restore).toHaveBeenCalled()
    expect(mockWindow.show).toHaveBeenCalled()
    expect(mockWindow.focus).toHaveBeenCalled()
    expect(mockWindow.setIcon).toHaveBeenCalled()
  })
})
