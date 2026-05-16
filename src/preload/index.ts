import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ipcRenderer } from 'electron/renderer'

const api = {
  getStore: (key: string): Promise<unknown> => ipcRenderer.invoke('store-get', key),
  setStore: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('store-set', key, value),
  deleteStore: (key: string): Promise<void> => ipcRenderer.invoke('store-delete', key),

  fetchCourses: (): Promise<unknown> => ipcRenderer.invoke('fetch-courses'),
  fetchCurriculum: (courseId: number): Promise<unknown> =>
    ipcRenderer.invoke('fetch-curriculum', courseId),

  selectFolder: (): Promise<string | null> => ipcRenderer.invoke('select-folder'),
  startDownload: (req: unknown): Promise<string> => ipcRenderer.invoke('start-download', req),
  cancelDownload: (lectureId: number): Promise<boolean> =>
    ipcRenderer.invoke('cancel-download', lectureId),
  checkLocalDownloads: (courseTitle: string): Promise<Record<number, string>> =>
    ipcRenderer.invoke('check-local-downloads', courseTitle),
  deleteCourseFolder: (courseTitle: string): Promise<boolean> =>
    ipcRenderer.invoke('delete-course-folder', courseTitle),
  moveDownloadsFolder: (oldPath: string, newPath: string) =>
    ipcRenderer.invoke('moveDownloadsFolder', oldPath, newPath)
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
