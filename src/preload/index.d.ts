import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AppSettings,
  AppVersionInfo,
  AuthResult,
  CacheClearResult,
  CourseItem,
  DiscordActivityPayload,
  DiscordPresenceStatus,
  DiskSpaceInfo,
  IntegrityCheckResult,
  LogEntry,
  PlatformId,
  PlatformSession,
  UpdaterStatusPayload,
  WebAuthOptions
} from '../shared/types'

export interface AppApiBridge {
  checkUpdates: () => Promise<void>
  getAppVersion: () => Promise<AppVersionInfo>
  exportDebugLogs: () => Promise<boolean>
  getLogs: () => Promise<LogEntry[]>
  clearLogs: () => Promise<void>
  onUpdaterStatus: (callback: (status: UpdaterStatusPayload) => void) => () => void
  resizeToMain: () => Promise<void>

  getSessions: () => Promise<PlatformSession[]>
  launchWebAuth: (options: WebAuthOptions) => Promise<AuthResult>
  removeSession: (platformId: PlatformId) => Promise<boolean>
  ensureValidToken: (platformId: PlatformId) => Promise<string | null>

  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void) => () => void
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<boolean>
  closeWindow: () => Promise<void>
  isMaximized: () => Promise<boolean>

  getCourses: (platformId: PlatformId) => Promise<CourseItem[]>

  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  resetSettings: () => Promise<AppSettings>
  selectDownloadDir: () => Promise<string | null>
  getDiskSpace: (customPath?: string) => Promise<DiskSpaceInfo | null>
  clearCache: () => Promise<CacheClearResult>
  checkIntegrity: (customPath?: string) => Promise<IntegrityCheckResult>
  isEncryptionAvailable: () => Promise<boolean>

  showNotification: (options: { title: string; body: string; force?: boolean }) => Promise<boolean>
  relaunchApp: () => Promise<void>
  getBootStatus: () => Promise<boolean>
  onJumpListNavigate?: (
    callback: (target: { platform?: string; view?: string }) => void
  ) => () => void
  onSettingsChanged?: (callback: (settings: AppSettings) => void) => () => void

  getDiscordStatus: () => Promise<DiscordPresenceStatus>
  onDiscordStatusChanged?: (callback: (status: DiscordPresenceStatus) => void) => () => void
  updateDiscordActivity: (payload?: DiscordActivityPayload) => Promise<void>
  clearDiscordActivity: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApiBridge
  }
}
