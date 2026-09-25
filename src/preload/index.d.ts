import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AppVersionInfo,
  AuthResult,
  PlatformId,
  PlatformSession,
  UpdaterStatusPayload,
  WebAuthOptions
} from '../shared/types'

export interface AppApiBridge {
  checkUpdates: () => Promise<void>
  getAppVersion: () => Promise<AppVersionInfo>
  exportDebugLogs: () => Promise<boolean>
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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppApiBridge
  }
}
