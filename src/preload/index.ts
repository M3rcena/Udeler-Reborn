import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge } from 'electron'
import { ipcRenderer } from 'electron/renderer'
import { IpcChannels } from './ipc-types'

const api = {
  invoke: <Channel extends keyof IpcChannels>(
    channel: Channel,
    ...args: IpcChannels[Channel]['args']
  ): Promise<IpcChannels[Channel]['returns']> => {
    return ipcRenderer.invoke(channel, ...args)
  },

  onDownloadProgress: (
    callback: (data: { lectureId: number; percentage: number }) => void
  ): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { lectureId: number; percentage: number }
    ): void => {
      callback(data)
    }

    ipcRenderer.on('download-progress', listener)

    return (): void => {
      ipcRenderer.removeListener('download-progress', listener)
    }
  },
  onSchedulePause: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('schedule-pause', listener)
    return (): void => {
      ipcRenderer.removeListener('schedule-pause', listener)
    }
  },
  onScheduleResume: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('schedule-resume', listener)
    return (): void => {
      ipcRenderer.removeListener('schedule-resume', listener)
    }
  }
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
