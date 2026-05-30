import type { IpcChannels } from '../../../preload/ipc-types'

declare global {
  interface Window {
    api: {
      invoke: <Channel extends keyof IpcChannels>(
        channel: Channel,
        ...args: IpcChannels[Channel]['args']
      ) => Promise<IpcChannels[Channel]['returns']>

      onDownloadProgress: (
        callback: (data: { lectureId: number; percentage: number }) => void
      ) => () => void
    }
  }
}
