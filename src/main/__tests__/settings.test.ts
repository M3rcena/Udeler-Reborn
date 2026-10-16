import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyPowerSaveBlocker,
  applyProxySettings,
  checkLibraryIntegrity,
  clearAppCache,
  getDiskSpaceInfo,
  SettingsManager
} from '../services/SettingsManager'

vi.mock('electron', () => {
  const electronMock = {
    app: {
      getPath: vi.fn((name: string) => {
        if (name === 'userData') return path.join(os.tmpdir(), 'udeler-test-userdata')
        if (name === 'downloads') return path.join(os.tmpdir(), 'udeler-test-downloads')
        if (name === 'temp') return path.join(os.tmpdir(), 'udeler-test-temp')
        return os.tmpdir()
      })
    },
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
    },
    session: {
      defaultSession: {
        setProxy: vi.fn().mockResolvedValue(undefined),
        getCacheSize: vi.fn().mockResolvedValue(4096),
        clearCache: vi.fn().mockResolvedValue(undefined),
        clearStorageData: vi.fn().mockResolvedValue(undefined)
      }
    },
    powerSaveBlocker: {
      start: vi.fn(() => 99),
      stop: vi.fn(),
      isStarted: vi.fn(() => true)
    }
  }
  return {
    default: electronMock,
    ...electronMock
  }
})

describe('SettingsManager Persistence & Security Service', () => {
  let tempFilePath: string
  let manager: SettingsManager

  beforeEach(() => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'udeler-settings-test-'))
    tempFilePath = path.join(tempDir, 'test-settings.json')
    manager = new SettingsManager(tempFilePath)
  })

  afterEach(() => {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath)
      }
      const dir = path.dirname(tempFilePath)
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    } catch {
      // Ignore cleanup error
    }
  })

  it('initializes default settings and creates file on disk', () => {
    const settings = manager.getSettings()
    expect(settings).toBeDefined()
    expect(settings.videoQuality).toBe('1080p')
    expect(settings.maxConcurrentDownloads).toBe(3)
    expect(fs.existsSync(tempFilePath)).toBe(true)

    const raw = fs.readFileSync(tempFilePath, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.settings.downloads).toBeDefined()
    expect(parsed.settings.media.videoQuality).toBe('1080p')
  })

  it('updates partial settings without overwriting other values', () => {
    manager.updateSettings({
      videoQuality: '720p',
      maxConcurrentDownloads: 5,
      locale: 'Greek',
      theme: 'midnight'
    })

    const updated = manager.getSettings()
    expect(updated.videoQuality).toBe('720p')
    expect(updated.maxConcurrentDownloads).toBe(5)
    expect(updated.locale).toBe('Greek')
    expect(updated.theme).toBe('midnight')
    // Other values remain intact
    expect(updated.videoFormat).toBe('mp4')

    // Reload from disk to verify persistence
    const reloadedManager = new SettingsManager(tempFilePath)
    const diskSettings = reloadedManager.getSettings()
    expect(diskSettings.videoQuality).toBe('720p')
    expect(diskSettings.maxConcurrentDownloads).toBe(5)
    expect(diskSettings.locale).toBe('Greek')
    expect(diskSettings.theme).toBe('midnight')
  })

  it('resets settings to factory defaults', () => {
    manager.updateSettings({
      videoQuality: '480p',
      theme: 'cyberpunk'
    })

    expect(manager.getSettings().theme).toBe('cyberpunk')

    manager.resetSettings()
    expect(manager.getSettings().videoQuality).toBe('1080p')
    expect(manager.getSettings().theme).toBe('violet')
  })

  it('handles corrupted JSON gracefully by backing up and restoring defaults', () => {
    fs.writeFileSync(tempFilePath, 'CORRUPTED_JSON_DATA{{{', 'utf-8')

    const recoveryManager = new SettingsManager(tempFilePath)
    const settings = recoveryManager.getSettings()

    expect(settings.videoQuality).toBe('1080p')
    expect(settings.maxConcurrentDownloads).toBe(3)

    // Check that a .corrupt backup file was created
    const dir = path.dirname(tempFilePath)
    const files = fs.readdirSync(dir)
    const hasCorruptBackup = files.some((f) => f.includes('.corrupt.'))
    expect(hasCorruptBackup).toBe(true)
  })

  it('determines disk space info correctly', () => {
    const dir = path.dirname(tempFilePath)
    const space = getDiskSpaceInfo(dir)
    expect(space).toBeDefined()
    if (space) {
      expect(space.freeBytes).toBeGreaterThanOrEqual(0)
      expect(space.totalBytes).toBeGreaterThan(0)
    }
  })

  it('clears webview and temporary file cache', async () => {
    const result = await clearAppCache()
    expect(result).toBeDefined()
    expect(result.reclaimedBytes).toBeGreaterThan(0)
  })

  it('audits library integrity and detects intact vs corrupt files', () => {
    const testLibDir = path.join(path.dirname(tempFilePath), 'courses-lib')
    fs.mkdirSync(testLibDir, { recursive: true })

    // Create 1 valid file (> 0 bytes) and 1 0-byte corrupt file
    fs.writeFileSync(path.join(testLibDir, 'valid-lecture.mp4'), 'VIDEO_DATA_BUFFER', 'utf-8')
    fs.writeFileSync(path.join(testLibDir, 'corrupt-lecture.mp4'), '', 'utf-8')

    const integrity = checkLibraryIntegrity(testLibDir)
    expect(integrity.totalFiles).toBe(2)
    expect(integrity.healthyFiles).toBe(1)
    expect(integrity.corruptFiles).toBe(1)
    expect(integrity.summary).toContain('1 empty or incomplete')
  })

  it('applies proxy settings across none, system, and custom modes', async () => {
    const settings = manager.getSettings()

    await applyProxySettings({ ...settings, proxyMode: 'none' })
    await applyProxySettings({ ...settings, proxyMode: 'system' })
    await applyProxySettings({
      ...settings,
      proxyMode: 'custom',
      proxyHost: '127.0.0.1',
      proxyPort: '8080'
    })
  })

  it('toggles power save blocker when downloading and halts when inactive', () => {
    const settings = manager.getSettings()

    applyPowerSaveBlocker({ ...settings, preventSleepWhileDownloading: true }, true)
    applyPowerSaveBlocker({ ...settings, preventSleepWhileDownloading: true }, false)
  })
})
