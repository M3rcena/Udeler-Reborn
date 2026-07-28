import { ElectronAPI } from '@electron-toolkit/preload'
import { IpcChannels } from './ipc-types'

export interface ApiBridge {
  invoke: <Channel extends keyof IpcChannels>(
    channel: Channel,
    ...args: IpcChannels[Channel]['args']
  ) => Promise<IpcChannels[Channel]['returns']>

  onDownloadProgress: (
    callback: (data: { lectureId: number; percentage: number; speed: number }) => void
  ) => () => void
  onSchedulePause: (callback: () => void) => () => void
  onScheduleResume: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ApiBridge
  }
}
