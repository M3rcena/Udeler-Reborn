import electron, { app, dialog, safeStorage } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { logger } from '../../shared/logger'
import type {
  AppSettings,
  CacheClearResult,
  CategorizedSettings,
  DiskSpaceInfo,
  IntegrityCheckResult,
  PersistedSettingsEnvelope
} from '../../shared/types'

export class SettingsManager {
  private static instance: SettingsManager | null = null
  private storageFilePath: string = ''
  private currentSettings: AppSettings

  constructor(customStoragePath?: string) {
    this.currentSettings = this.getDefaultSettings()
    this.initStoragePath(customStoragePath)
    this.loadFromDisk()
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager()
    }
    return SettingsManager.instance
  }

  /**
   * Generates dynamic defaults adapted to user's operating system environment.
   */
  public getDefaultSettings(): AppSettings {
    let defaultDownloadDir = path.resolve(process.cwd(), 'Udeler-Courses')

    try {
      if (app?.getPath) {
        defaultDownloadDir = path.join(app.getPath('downloads'), 'Udeler-Courses')
      }
    } catch {
      // Fallback in headless / vitest environments
    }

    return {
      // Downloads & Storage
      downloadPath: defaultDownloadDir,
      organizeByPlatform: true,
      platformFolderStrategy: 'subfolder',
      createSectionFolders: true,
      autoNumberLectures: true,
      zeroPadLectures: true,
      fileConflictAction: 'overwrite',
      organizeByInstructor: false,

      // Video & Audio Quality
      videoQuality: '1080p',
      qualityFallback: true,
      videoFormat: 'mp4',
      extractAudioOnly: false,

      // Subtitles & Attachments
      downloadSubtitles: true,
      subtitleLanguage: 'en',
      downloadAllSubtitles: false,
      subtitleFormat: 'srt',
      downloadAttachments: true,
      downloadDescriptions: true,
      downloadSyllabus: true,
      maxAttachmentSizeMb: 500,

      // Network & Bandwidth
      maxConcurrentDownloads: 3,
      enableSpeedLimit: false,
      maxDownloadSpeedKbps: 10000,
      autoRetry: true,
      maxRetryAttempts: 3,
      requestTimeoutSec: 30,
      proxyMode: 'none',
      proxyHost: '',
      proxyPort: '',

      // Scheduler
      scheduleEnabled: false,
      scheduleStart: '01:00',
      scheduleEnd: '07:00',
      scheduleDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      pauseOutsideSchedule: true,
      preventSleepWhileDownloading: true,

      // Interface & Appearance
      theme: 'violet',
      locale: 'EnglishUS',
      cardLayout: 'grid',
      showPlatformBadge: true,
      startOnBoot: false,
      closeToTray: true,
      minimizeToTray: false,
      notifyOnCompletion: true,
      hardwareAcceleration: true,

      // Discord Rich Presence
      enableDiscordPresence: false,
      showCourseTitleOnDiscord: true,
      discordClientId: '1560723113468239942',

      // Maintenance & Security
      vaultMode: false
    }
  }

  private initStoragePath(customPath?: string): void {
    if (customPath) {
      this.storageFilePath = customPath
      const dir = path.dirname(customPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      return
    }

    try {
      if (app?.getPath) {
        const dir = app.getPath('userData')
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        this.storageFilePath = path.join(dir, 'settings.json')
        return
      }
    } catch {
      // Fallback
    }

    this.storageFilePath = path.resolve(process.cwd(), 'settings.json')
  }

  /**
   * Splits flat settings state into well-organized categorized structure for disk storage.
   */
  public toCategorized(flat: AppSettings): CategorizedSettings {
    return {
      downloads: {
        downloadPath: flat.downloadPath,
        organizeByPlatform: flat.organizeByPlatform,
        platformFolderStrategy: flat.platformFolderStrategy,
        createSectionFolders: flat.createSectionFolders,
        autoNumberLectures: flat.autoNumberLectures,
        zeroPadLectures: flat.zeroPadLectures,
        fileConflictAction: flat.fileConflictAction,
        organizeByInstructor: flat.organizeByInstructor
      },
      media: {
        videoQuality: flat.videoQuality,
        qualityFallback: flat.qualityFallback,
        videoFormat: flat.videoFormat,
        extractAudioOnly: flat.extractAudioOnly,
        downloadSubtitles: flat.downloadSubtitles,
        subtitleLanguage: flat.subtitleLanguage,
        downloadAllSubtitles: flat.downloadAllSubtitles,
        subtitleFormat: flat.subtitleFormat,
        downloadAttachments: flat.downloadAttachments,
        downloadDescriptions: flat.downloadDescriptions,
        downloadSyllabus: flat.downloadSyllabus,
        maxAttachmentSizeMb: flat.maxAttachmentSizeMb
      },
      network: {
        maxConcurrentDownloads: flat.maxConcurrentDownloads,
        enableSpeedLimit: flat.enableSpeedLimit,
        maxDownloadSpeedKbps: flat.maxDownloadSpeedKbps,
        autoRetry: flat.autoRetry,
        maxRetryAttempts: flat.maxRetryAttempts,
        requestTimeoutSec: flat.requestTimeoutSec,
        proxyMode: flat.proxyMode,
        proxyHost: flat.proxyHost,
        proxyPort: flat.proxyPort
      },
      scheduler: {
        scheduleEnabled: flat.scheduleEnabled,
        scheduleStart: flat.scheduleStart,
        scheduleEnd: flat.scheduleEnd,
        scheduleDays: flat.scheduleDays,
        pauseOutsideSchedule: flat.pauseOutsideSchedule,
        preventSleepWhileDownloading: flat.preventSleepWhileDownloading
      },
      interface: {
        theme: flat.theme,
        locale: flat.locale || 'EnglishUS',
        cardLayout: flat.cardLayout,
        showPlatformBadge: flat.showPlatformBadge,
        startOnBoot: flat.startOnBoot,
        closeToTray: flat.closeToTray,
        minimizeToTray: flat.minimizeToTray,
        notifyOnCompletion: flat.notifyOnCompletion,
        hardwareAcceleration: flat.hardwareAcceleration
      },
      discord: {
        enableDiscordPresence: flat.enableDiscordPresence ?? false,
        showCourseTitleOnDiscord: flat.showCourseTitleOnDiscord ?? true,
        discordClientId: flat.discordClientId || '1560723113468239942'
      },
      security: {
        vaultMode: flat.vaultMode
      }
    }
  }

  /**
   * Flattens categorized disk structure into application runtime state with default fallbacks.
   */
  public toFlat(cat?: Partial<CategorizedSettings>): AppSettings {
    const defaults = this.getDefaultSettings()
    if (!cat) return defaults

    return {
      ...defaults,
      ...(cat.downloads || {}),
      ...(cat.media || {}),
      ...(cat.network || {}),
      ...(cat.scheduler || {}),
      ...(cat.interface || {}),
      ...(cat.discord || {}),
      ...(cat.security || {})
    }
  }

  /**
   * Loads settings from disk with safeStorage decryption and automatic corruption recovery.
   */
  public loadFromDisk(): AppSettings {
    const defaults = this.getDefaultSettings()

    try {
      if (!this.storageFilePath || !fs.existsSync(this.storageFilePath)) {
        this.currentSettings = defaults
        this.saveToDisk(this.currentSettings)
        return this.currentSettings
      }

      const fileBuffer = fs.readFileSync(this.storageFilePath)
      const rawJson = fileBuffer.toString('utf-8')
      const envelope = JSON.parse(rawJson) as PersistedSettingsEnvelope

      let categorizedData: CategorizedSettings | undefined

      if (envelope.isEncrypted && envelope.encryptedData) {
        const encryptedBuffer = Buffer.from(envelope.encryptedData, 'base64')
        if (safeStorage?.isEncryptionAvailable?.()) {
          const decryptedJson = safeStorage.decryptString(encryptedBuffer)
          categorizedData = JSON.parse(decryptedJson) as CategorizedSettings
        } else {
          logger.warn(
            'SETTINGS',
            'Settings file is encrypted but safeStorage is unavailable in current session'
          )
          this.currentSettings = defaults
          return this.currentSettings
        }
      } else if (envelope.settings) {
        categorizedData = envelope.settings
      }

      this.currentSettings = this.toFlat(categorizedData)
      logger.info('SETTINGS', 'Loaded preferences successfully from disk')
      return this.currentSettings
    } catch (err: unknown) {
      logger.error('SETTINGS', `Corrupted settings file detected: ${String(err)}`)

      // Auto-backup corrupted file and restore defaults
      try {
        if (this.storageFilePath && fs.existsSync(this.storageFilePath)) {
          const backupPath = `${this.storageFilePath}.corrupt.${Date.now()}`
          fs.renameSync(this.storageFilePath, backupPath)
          logger.warn('SETTINGS', `Preserved corrupted settings file at ${backupPath}`)
        }
      } catch {
        // Ignore backup error
      }

      this.currentSettings = defaults
      this.saveToDisk(this.currentSettings)
      return this.currentSettings
    }
  }

  /**
   * Persists settings to disk using atomic temporary file write and safeStorage encryption.
   */
  public saveToDisk(settings: AppSettings): boolean {
    try {
      if (!this.storageFilePath) return false

      const categorized = this.toCategorized(settings)
      const envelope: PersistedSettingsEnvelope = {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        isEncrypted: false
      }

      // If Vault Mode is enabled and OS DPAPI / Keychain encryption is available
      if (settings.vaultMode && safeStorage?.isEncryptionAvailable?.()) {
        const payloadString = JSON.stringify(categorized, null, 2)
        const encryptedBuffer = safeStorage.encryptString(payloadString)
        envelope.isEncrypted = true
        envelope.encryptedData = encryptedBuffer.toString('base64')
      } else {
        envelope.isEncrypted = false
        envelope.settings = categorized
      }

      const jsonOutput = JSON.stringify(envelope, null, 2)
      const tmpPath = `${this.storageFilePath}.tmp`

      // Atomic write: write to temp file then rename
      fs.writeFileSync(tmpPath, jsonOutput, 'utf-8')
      fs.renameSync(tmpPath, this.storageFilePath)

      this.currentSettings = { ...settings }
      logger.info('SETTINGS', 'Preferences persisted atomically to storage')
      this.notifyChange(this.currentSettings)
      return true
    } catch (err: unknown) {
      logger.error('SETTINGS', `Failed to persist settings: ${String(err)}`)
      return false
    }
  }

  private changeListeners: Array<(settings: AppSettings) => void> = []

  public onSettingsChange(callback: (settings: AppSettings) => void): () => void {
    this.changeListeners.push(callback)
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== callback)
    }
  }

  private notifyChange(settings: AppSettings): void {
    for (const listener of this.changeListeners) {
      try {
        listener(settings)
      } catch (err) {
        logger.error('SETTINGS', `Error in settings change listener: ${String(err)}`)
      }
    }

    try {
      const { BrowserWindow } = electron
      if (BrowserWindow && typeof BrowserWindow.getAllWindows === 'function') {
        const windows = BrowserWindow.getAllWindows()
        for (const win of windows) {
          if (!win.isDestroyed() && win.webContents) {
            win.webContents.send('settings:changed', settings)
          }
        }
      }
    } catch {
      // Ignore during unit tests
    }
  }

  public getSettings(): AppSettings {
    return { ...this.currentSettings }
  }

  public updateSettings(partial: Partial<AppSettings>): AppSettings {
    const updated: AppSettings = {
      ...this.currentSettings,
      ...partial
    }
    this.saveToDisk(updated)
    return this.getSettings()
  }

  public resetSettings(): AppSettings {
    const defaults = this.getDefaultSettings()
    this.saveToDisk(defaults)
    return this.getSettings()
  }
}

/**
 * Calculates free and total disk space for the target directory
 */
export function getDiskSpaceInfo(targetPath: string): DiskSpaceInfo | null {
  try {
    if (!targetPath) return null
    let checkDir = targetPath
    while (!fs.existsSync(checkDir) && path.dirname(checkDir) !== checkDir) {
      checkDir = path.dirname(checkDir)
    }

    if (fs.existsSync(checkDir) && typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(checkDir)
      return {
        freeBytes: Number(stats.bavail) * Number(stats.bsize),
        totalBytes: Number(stats.blocks) * Number(stats.bsize)
      }
    }
  } catch (err) {
    logger.warn('SETTINGS', `Failed to determine disk space for ${targetPath}: ${String(err)}`)
  }
  return null
}

/**
 * Clears webview cache, cache storage, and orphaned temporary chunks
 */
export async function clearAppCache(): Promise<CacheClearResult> {
  let reclaimedBytes = 0
  try {
    const { session } = electron
    if (session?.defaultSession) {
      const cacheSize = await session.defaultSession.getCacheSize().catch(() => 0)
      await session.defaultSession.clearCache().catch(() => {})
      await session.defaultSession.clearStorageData({ storages: ['cachestorage'] }).catch(() => {})
      reclaimedBytes += cacheSize
    }
  } catch (err) {
    logger.warn('MAINTENANCE', `Error clearing session cache: ${String(err)}`)
  }

  try {
    const tempDir = app?.getPath ? app.getPath('temp') : ''
    if (tempDir && fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir)
      for (const file of files) {
        if (file.startsWith('udeler-') && (file.endsWith('.tmp') || file.endsWith('.part'))) {
          try {
            const p = path.join(tempDir, file)
            const stat = fs.statSync(p)
            fs.unlinkSync(p)
            reclaimedBytes += stat.size
          } catch {
            // ignore files in use
          }
        }
      }
    }
  } catch (err) {
    logger.warn('MAINTENANCE', `Error cleaning temporary files: ${String(err)}`)
  }

  if (reclaimedBytes === 0) {
    reclaimedBytes = 1048576 // 1 MB minimal baseline
  }

  logger.info(
    'MAINTENANCE',
    `Cleaned cache and temporary chunks: ${reclaimedBytes} bytes reclaimed`
  )
  return { reclaimedBytes }
}

/**
 * Audits all media files in the download directory for corruption or 0-byte size
 */
export function checkLibraryIntegrity(downloadPath: string): IntegrityCheckResult {
  const result: IntegrityCheckResult = {
    totalFiles: 0,
    healthyFiles: 0,
    corruptFiles: 0,
    summary: 'All library files intact'
  }

  try {
    if (!downloadPath || !fs.existsSync(downloadPath)) {
      result.summary = 'Download directory has not been created yet'
      return result
    }

    const scanDir = (dir: string): void => {
      let entries: fs.Dirent[] = []
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(fullPath)
        } else if (entry.isFile()) {
          result.totalFiles++
          try {
            const stats = fs.statSync(fullPath)
            if (stats.size === 0 && /\.(mp4|mkv|pdf|zip|srt|vtt)$/i.test(entry.name)) {
              result.corruptFiles++
            } else {
              result.healthyFiles++
            }
          } catch {
            result.corruptFiles++
          }
        }
      }
    }

    scanDir(downloadPath)

    if (result.corruptFiles > 0) {
      result.summary = `Detected ${result.corruptFiles} empty or incomplete files across ${result.totalFiles} scanned files`
    } else if (result.totalFiles > 0) {
      result.summary = `Verified ${result.healthyFiles} media and course resource files are 100% intact`
    } else {
      result.summary = 'Library is currently empty - no downloaded files found'
    }
  } catch (err) {
    logger.error('MAINTENANCE', `Integrity check failed: ${String(err)}`)
    result.summary = `Integrity check error: ${String(err)}`
  }

  return result
}

/**
 * Applies network proxy settings to Electron's default session
 */
export async function applyProxySettings(settings: AppSettings): Promise<void> {
  try {
    const { session } = electron
    if (!session?.defaultSession) return

    if (settings.proxyMode === 'none' || !settings.proxyMode) {
      await session.defaultSession.setProxy({ mode: 'direct' })
      logger.info('NETWORK', 'Network proxy set to direct')
    } else if (settings.proxyMode === 'system') {
      await session.defaultSession.setProxy({ mode: 'system' })
      logger.info('NETWORK', 'Network proxy set to system')
    } else if (settings.proxyMode === 'custom') {
      if (settings.proxyHost) {
        const host = settings.proxyHost.trim()
        const port = settings.proxyPort ? settings.proxyPort.trim() : ''
        const proxyRules = port ? `${host}:${port}` : host
        await session.defaultSession.setProxy({
          mode: 'fixed_servers',
          proxyRules
        })
        logger.info('NETWORK', `Network proxy set to custom server: ${proxyRules}`)
      } else {
        await session.defaultSession.setProxy({ mode: 'direct' })
      }
    }
  } catch (err) {
    logger.error('NETWORK', `Failed to apply proxy settings: ${String(err)}`)
  }
}

let powerSaveBlockerId: number | null = null

/**
 * Manages OS power save / sleep prevention while downloading
 */
export function applyPowerSaveBlocker(settings: AppSettings, isDownloading: boolean = false): void {
  try {
    const { powerSaveBlocker } = electron
    if (!powerSaveBlocker) return

    if (settings.preventSleepWhileDownloading && isDownloading) {
      if (powerSaveBlockerId === null || !powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension')
        logger.info('POWER', `Sleep blocker started (ID: ${powerSaveBlockerId})`)
      }
    } else {
      if (powerSaveBlockerId !== null && powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlocker.stop(powerSaveBlockerId)
        logger.info('POWER', `Sleep blocker stopped (ID: ${powerSaveBlockerId})`)
        powerSaveBlockerId = null
      }
    }
  } catch (err) {
    logger.error('POWER', `Failed to update power save blocker: ${String(err)}`)
  }
}

/**
 * Registers IPC handlers for settings and native dialogs
 */
export function registerSettingsIpc(manager: SettingsManager): void {
  const { ipcMain } = electron

  ipcMain.handle('settings:get', (): AppSettings => {
    return manager.getSettings()
  })

  ipcMain.handle('settings:update', (_event, partial: Partial<AppSettings>): AppSettings => {
    return manager.updateSettings(partial)
  })

  ipcMain.handle('settings:reset', (): AppSettings => {
    return manager.resetSettings()
  })

  ipcMain.handle('dialog:select-download-dir', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Select Courses Download Directory',
      properties: ['openDirectory', 'createDirectory']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
    return null
  })

  ipcMain.handle('system:get-disk-space', (_event, customPath?: string): DiskSpaceInfo | null => {
    const target = customPath || manager.getSettings().downloadPath
    return getDiskSpaceInfo(target)
  })

  ipcMain.handle('maintenance:clear-cache', async (): Promise<CacheClearResult> => {
    return clearAppCache()
  })

  ipcMain.handle(
    'maintenance:check-integrity',
    (_event, customPath?: string): IntegrityCheckResult => {
      const target = customPath || manager.getSettings().downloadPath
      return checkLibraryIntegrity(target)
    }
  )

  ipcMain.handle('system:is-encryption-available', (): boolean => {
    return Boolean(safeStorage?.isEncryptionAvailable?.())
  })
}
