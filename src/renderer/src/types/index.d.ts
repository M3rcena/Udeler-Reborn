import type { DownloadedFile, IpcChannels } from '../../../preload/ipc-types'

declare global {
  interface Window {
    api: {
      invoke: <Channel extends keyof IpcChannels>(
        channel: Channel,
        ...args: IpcChannels[Channel]['args']
      ) => Promise<IpcChannels[Channel]['returns']>

      onDownloadProgress: (
        callback: (data: { lectureId: number; percentage: number; speed: number }) => void
      ) => () => void
      onSchedulePause: (callback: () => void) => () => void
      onScheduleResume: (callback: () => void) => () => void
      onTrayAction: (callback: (action: 'pause' | 'resume' | 'cancel') => void) => () => void
      onNavigateCourse: (callback: (courseId: number) => void) => () => void
      onPlayRecentMedia: (callback: (file: DownloadedFile) => void) => () => void
    }
  }
}
