import { ElectronAPI } from '@electron-toolkit/preload'

export interface ApiBridge {
  exportDebugLogs: () => Promise<boolean>
  getStore: (key: string) => Promise<unknown>
  setStore: (key: string, value: unknown) => Promise<void>
  deleteStore: (key: string) => Promise<void>
  fetchCourses: () => Promise<unknown>
  fetchCurriculum: (courseId: number) => Promise<unknown>
  selectFolder: () => Promise<string | null>
  startDownload: (req: unknown) => Promise<string>
  cancelDownload: (lectureId: number) => Promise<boolean>
  pauseDownload: (lectureId: number) => Promise<boolean>
  checkLocalDownloads: (courseTitle: string) => Promise<Record<number, string>>
  deleteCourseFolder: (courseTitle: string) => Promise<boolean>
  moveDownloadsFolder: (oldPath: string, newPath: string) => Promise<unknown>
  getAllDownloads: () => Promise<unknown>
  deleteLecture: (courseTitle: string, lectureId: number) => Promise<boolean>
  deleteFileByPath: (filePath: string) => Promise<boolean>
  onDownloadProgress: (
    callback: (data: { lectureId: number; percentage: number }) => void
  ) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ApiBridge
  }
}
