import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { IpcChannels, IpcManifestEntry } from '../../preload/types/ipc-types'

const IPC_MANIFEST: Record<keyof IpcChannels, IpcManifestEntry> = {
  'export-debug-logs': { tier: 'filesystem-write', maxCallsPerSecond: 5 },
  'store-get': { tier: 'read-only-metadata', maxCallsPerSecond: 100 },
  'store-set': { tier: 'filesystem-write', maxCallsPerSecond: 100 },
  'store-delete': { tier: 'filesystem-write', maxCallsPerSecond: 50 },
  'get-storage-stats': { tier: 'read-only-metadata', maxCallsPerSecond: 20 },
  'run-garbage-collector': { tier: 'filesystem-write', maxCallsPerSecond: 5 },
  'fetch-courses': { tier: 'network', maxCallsPerSecond: 10 },
  'fetch-curriculum': { tier: 'network', maxCallsPerSecond: 20 },
  'select-folder': { tier: 'read-only-metadata', maxCallsPerSecond: 10 },
  'start-download': { tier: 'network', maxCallsPerSecond: 50 },
  'get-all-downloads': { tier: 'read-only-metadata', maxCallsPerSecond: 20 },
  'check-local-downloads': { tier: 'read-only-metadata', maxCallsPerSecond: 50 },
  'delete-course-folder': { tier: 'filesystem-write', maxCallsPerSecond: 10 },
  'delete-all-downloads': { tier: 'filesystem-write', maxCallsPerSecond: 5 },
  'cancel-download': { tier: 'filesystem-write', maxCallsPerSecond: 50 },
  'pause-download': { tier: 'filesystem-write', maxCallsPerSecond: 50 },
  moveDownloadsFolder: { tier: 'filesystem-write', maxCallsPerSecond: 2 },
  'delete-lecture': { tier: 'filesystem-write', maxCallsPerSecond: 50 },
  'delete-file-by-path': { tier: 'filesystem-write', maxCallsPerSecond: 50 },
  'login-udemy': { tier: 'credential-access', maxCallsPerSecond: 5 },
  'os-set-progress': { tier: 'read-only-metadata', maxCallsPerSecond: 100 },
  'os-set-tray-tooltip': { tier: 'read-only-metadata', maxCallsPerSecond: 100 },
  'os-set-recent-course': { tier: 'read-only-metadata', maxCallsPerSecond: 50 },
  'os-hide-to-tray': { tier: 'read-only-metadata', maxCallsPerSecond: 10 },
  'os-update-queue-menu': { tier: 'read-only-metadata', maxCallsPerSecond: 50 },
  'os-show-item-in-folder': { tier: 'read-only-metadata', maxCallsPerSecond: 10 },
  'search-index': { tier: 'read-only-metadata', maxCallsPerSecond: 100 },
  'rebuild-search-index': { tier: 'read-only-metadata', maxCallsPerSecond: 10 },
  'start-integrity-scan': { tier: 'filesystem-write', maxCallsPerSecond: 5 },
  'get-volume-mappings': { tier: 'read-only-metadata', maxCallsPerSecond: 50 },
  'register-volume': { tier: 'filesystem-write', maxCallsPerSecond: 10 },
  'get-all-volumes': { tier: 'read-only-metadata', maxCallsPerSecond: 50 },
  'pin-course': { tier: 'filesystem-write', maxCallsPerSecond: 20 },
  'unpin-course': { tier: 'filesystem-write', maxCallsPerSecond: 20 },
  'get-security-audit-stats': { tier: 'read-only-metadata', maxCallsPerSecond: 100 }
}

let passedChecks = 0
let anomalies = 0

const rateLimits = new Map<string, number[]>()

export function getAuditStats(): {
  passedChecks: number
  anomalies: number
} {
  return { passedChecks, anomalies }
}

export function registerSecureIpc<K extends keyof IpcChannels>(
  channel: K,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: IpcChannels[K]['args']
  ) => Promise<IpcChannels[K]['returns']> | IpcChannels[K]['returns']
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    const manifest = IPC_MANIFEST[channel]

    if (!manifest) {
      anomalies++
      console.warn(`[IPC AUDIT] Blocked unregistered IPC channel: ${channel}`)
      throw new Error('Unauthorized IPC channel access')
    }

    if (event.senderFrame) {
      const isMainFrame = event.senderFrame.parent === null
      if (!isMainFrame) {
        anomalies++
        console.warn(
          `[IPC AUDIT] Blocked IPC call from unauthorized sub-frame. Channel: ${channel}`
        )
        throw new Error('Unauthorized frame origin')
      }
    }

    const now = Date.now()
    const limitHistory = rateLimits.get(channel) || []
    const recentCalls = limitHistory.filter((t) => now - t < 1000)

    if (recentCalls.length >= manifest.maxCallsPerSecond) {
      anomalies++
      console.warn(`[IPC AUDIT] Rate limit exceeded for ${channel} (Tier: ${manifest.tier})`)
      throw new Error('IPC rate limit exceeded')
    }

    recentCalls.push(now)
    rateLimits.set(channel, recentCalls)

    passedChecks++

    // @ts-expect-error Tuple spreading requirement
    return handler(event, ...args)
  })
}
