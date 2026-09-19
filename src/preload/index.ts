import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppVersionInfo,
  AuthResult,
  PlatformId,
  PlatformSession,
  UpdaterStatusPayload,
  WebAuthOptions
} from '../shared/types'

const api = {
  checkUpdates: (): Promise<void> => ipcRenderer.invoke('updater:check'),
  getAppVersion: (): Promise<AppVersionInfo> => ipcRenderer.invoke('app:version'),
  exportDebugLogs: (): Promise<boolean> => ipcRenderer.invoke('export-debug-logs'),
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
    ipcRenderer.invoke('auth:ensure-valid-token', platformId)
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
