import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
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

const api = {
  checkUpdates: (): Promise<void> => ipcRenderer.invoke('updater:check'),
  getAppVersion: (): Promise<AppVersionInfo> => ipcRenderer.invoke('app:version'),
  exportDebugLogs: (): Promise<boolean> => ipcRenderer.invoke('export-debug-logs'),
  getLogs: (): Promise<LogEntry[]> => ipcRenderer.invoke('logger:get'),
  clearLogs: (): Promise<void> => ipcRenderer.invoke('logger:clear'),
  onUpdaterStatus: (callback: (status: UpdaterStatusPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: UpdaterStatusPayload): void => {
      callback(data)
    }
    ipcRenderer.on('updater:status', handler)
    return () => {
      ipcRenderer.removeListener('updater:status', handler)
    }
  },
  resizeToMain: (): Promise<void> => ipcRenderer.invoke('app:resize-to-main'),

  getSessions: (): Promise<PlatformSession[]> => ipcRenderer.invoke('auth:get-sessions'),
  launchWebAuth: (options: WebAuthOptions): Promise<AuthResult> =>
    ipcRenderer.invoke('auth:launch-web', options),
  removeSession: (platformId: PlatformId): Promise<boolean> =>
    ipcRenderer.invoke('auth:remove-session', platformId),
  ensureValidToken: (platformId: PlatformId): Promise<string | null> =>
    ipcRenderer.invoke('auth:ensure-valid-token', platformId),

  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: { isMaximized: boolean }): void => {
      callback(state)
    }
    ipcRenderer.on('window:state-changed', handler)
    return () => {
      ipcRenderer.removeListener('window:state-changed', handler)
    }
  },
  minimizeWindow: (): Promise<void> => ipcRenderer.invoke('app:minimize'),
  maximizeWindow: (): Promise<boolean> => ipcRenderer.invoke('app:maximize'),
  closeWindow: (): Promise<void> => ipcRenderer.invoke('app:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('app:is-maximized'),

  getCourses: (platformId: PlatformId): Promise<CourseItem[]> =>
    ipcRenderer.invoke('courses:get', platformId),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', settings),
  resetSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:reset'),
  selectDownloadDir: (): Promise<string | null> => ipcRenderer.invoke('dialog:select-download-dir'),
  getDiskSpace: (customPath?: string): Promise<DiskSpaceInfo | null> =>
    ipcRenderer.invoke('system:get-disk-space', customPath),
  clearCache: (): Promise<CacheClearResult> => ipcRenderer.invoke('maintenance:clear-cache'),
  checkIntegrity: (customPath?: string): Promise<IntegrityCheckResult> =>
    ipcRenderer.invoke('maintenance:check-integrity', customPath),
  isEncryptionAvailable: (): Promise<boolean> =>
    ipcRenderer.invoke('system:is-encryption-available'),

  showNotification: (options: { title: string; body: string; force?: boolean }): Promise<boolean> =>
    ipcRenderer.invoke('notification:show', options),
  relaunchApp: (): Promise<void> => ipcRenderer.invoke('app:relaunch'),
  getBootStatus: (): Promise<boolean> => ipcRenderer.invoke('app:get-boot-status'),

  onJumpListNavigate: (
    callback: (target: { platform?: string; view?: string }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      target: { platform?: string; view?: string }
    ): void => {
      callback(target)
    }
    ipcRenderer.on('jumplist:navigate', handler)
    return () => {
      ipcRenderer.removeListener('jumplist:navigate', handler)
    }
  },

  onSettingsChanged: (callback: (settings: AppSettings) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, settings: AppSettings): void => {
      callback(settings)
    }
    ipcRenderer.on('settings:changed', handler)
    return () => {
      ipcRenderer.removeListener('settings:changed', handler)
    }
  },

  getDiscordStatus: (): Promise<DiscordPresenceStatus> => ipcRenderer.invoke('discord:get-status'),
  onDiscordStatusChanged: (callback: (status: DiscordPresenceStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: DiscordPresenceStatus): void => {
      callback(status)
    }
    ipcRenderer.on('discord:status-changed', handler)
    return () => {
      ipcRenderer.removeListener('discord:status-changed', handler)
    }
  },
  updateDiscordActivity: (payload?: DiscordActivityPayload): Promise<void> =>
    ipcRenderer.invoke('discord:update-activity', payload),
  clearDiscordActivity: (): Promise<void> => ipcRenderer.invoke('discord:clear-activity')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
