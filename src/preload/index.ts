import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge } from 'electron'
import { ipcRenderer } from 'electron/renderer'
import { DownloadedFile, IpcChannels } from './ipc-types'

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
  },
  onTrayAction: (callback: (action: 'pause' | 'resume' | 'cancel') => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      action: 'pause' | 'resume' | 'cancel'
    ): void => {
      callback(action)
    }
    ipcRenderer.on('tray-action', listener)
    return (): void => {
      ipcRenderer.removeListener('tray-action', listener)
    }
  },
  onPlayRecentMedia: (callback: (file: DownloadedFile) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, file: DownloadedFile): void => {
      callback(file)
    }
    ipcRenderer.on('play-recent-media', listener)
    return (): void => {
      ipcRenderer.removeListener('play-recent-media', listener)
    }
  },
  onNavigateCourse: (callback: (courseId: number) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, courseId: number): void => {
      callback(courseId)
    }
    ipcRenderer.on('navigate-course', listener)
    return (): void => {
      ipcRenderer.removeListener('navigate-course', listener)
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
