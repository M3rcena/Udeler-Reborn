import electron from 'electron'
import * as fs from 'node:fs'
import * as net from 'node:net'
import * as path from 'node:path'
import { logger } from '../../shared/logger'
import type { AppSettings, DiscordActivityPayload, DiscordPresenceStatus } from '../../shared/types'
import { SettingsManager } from './SettingsManager'

export const DEFAULT_DISCORD_CLIENT_ID = '1560723113468239942'

// Discord RPC Opcodes
enum Opcode {
  HANDSHAKE = 0,
  FRAME = 1,
  CLOSE = 2,
  PING = 3,
  PONG = 4
}

export class DiscordRpcManager {
  private static instance: DiscordRpcManager | null = null

  private socket: net.Socket | null = null
  private isConnected: boolean = false
  private isConnecting: boolean = false
  private clientId: string = DEFAULT_DISCORD_CLIENT_ID
  private startTimestamp: number = Math.floor(Date.now() / 1000)
  private heartbeatInterval: NodeJS.Timeout | null = null

  private discordUser: { id: string; username: string; discriminator?: string } | null = null
  private currentActivityDetails?: string
  private lastPayload?: DiscordActivityPayload
  private pendingActivity: Record<string, unknown> | null = null

  private constructor() {
    // Initialized via getInstance
  }

  public static getInstance(): DiscordRpcManager {
    if (!DiscordRpcManager.instance) {
      DiscordRpcManager.instance = new DiscordRpcManager()
    }
    return DiscordRpcManager.instance
  }

  public getStatus(): DiscordPresenceStatus {
    return {
      isConnected: this.isConnected,
      isEnabled: SettingsManager.getInstance().getSettings().enableDiscordPresence,
      username: this.discordUser?.username,
      activityDetails: this.currentActivityDetails
    }
  }

  /**
   * Discovers the IPC pipe paths for Discord on the host operating system
   */
  private getCandidatePipePaths(): string[] {
    const paths: string[] = []

    if (process.platform === 'win32') {
      for (let i = 0; i < 10; i++) {
        paths.push(`\\\\.\\pipe\\discord-ipc-${i}`)
      }
      return paths
    }

    const env = process.env
    const dirs = [env.XDG_RUNTIME_DIR, env.TMPDIR, env.TMP, env.TEMP, '/tmp'].filter(
      Boolean
    ) as string[]

    for (const dir of dirs) {
      for (let i = 0; i < 10; i++) {
        const full = path.join(dir, `discord-ipc-${i}`)
        if (fs.existsSync(full)) {
          paths.push(full)
        }
      }
    }

    if (paths.length === 0 && dirs[0]) {
      for (let i = 0; i < 10; i++) {
        paths.push(path.join(dirs[0], `discord-ipc-${i}`))
      }
    }

    return paths
  }

  /**
   * Attempts connection across available candidate pipes
   */
  public async connect(): Promise<boolean> {
    if (this.socket && !this.socket.destroyed && this.isConnected) {
      return true
    }

    if (this.isConnecting) {
      return false
    }

    this.isConnecting = true
    const candidates = this.getCandidatePipePaths()

    for (const pipePath of candidates) {
      const success = await this.tryConnectPipe(pipePath)
      if (success) {
        this.isConnecting = false
        return true
      }
    }

    this.isConnecting = false
    return false
  }

  private tryConnectPipe(pipePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false
      const done = (ok: boolean): void => {
        if (!resolved) {
          resolved = true
          resolve(ok)
        }
      }

      let sock: net.Socket | null = null
      try {
        sock = net.createConnection({ path: pipePath })
      } catch {
        done(false)
        return
      }

      sock.setTimeout(500)

      sock.once('connect', () => {
        sock?.setTimeout(0)
        this.socket = sock
        this.setupSocket(sock!)
        this.sendHandshake()
        done(true)
      })

      sock.once('error', () => {
        sock?.destroy()
        done(false)
      })

      sock.once('timeout', () => {
        sock?.destroy()
        done(false)
      })
    })
  }

  private setupSocket(sock: net.Socket): void {
    let incomingBuffer = Buffer.alloc(0)

    sock.on('data', (chunk: Buffer) => {
      incomingBuffer = Buffer.concat([incomingBuffer, chunk])

      while (incomingBuffer.length >= 8) {
        const opcode = incomingBuffer.readUInt32LE(0)
        const length = incomingBuffer.readUInt32LE(4)

        if (incomingBuffer.length < 8 + length) {
          break
        }

        const payloadBuf = incomingBuffer.subarray(8, 8 + length)
        incomingBuffer = incomingBuffer.subarray(8 + length)

        try {
          const payloadStr = payloadBuf.toString('utf-8')
          this.handlePacket(opcode, payloadStr)
        } catch (err) {
          logger.warn('DISCORD', `Error processing Discord IPC packet: ${String(err)}`)
        }
      }
    })

    sock.on('error', (err) => {
      logger.debug?.('DISCORD', `Discord socket error: ${String(err)}`)
      this.handleSocketClosed()
    })

    sock.on('close', () => {
      this.handleSocketClosed()
    })
  }

  private handleSocketClosed(): void {
    const wasConnected = this.isConnected
    this.isConnected = false
    this.socket = null
    this.discordUser = null
    if (wasConnected) {
      this.notifyStatusChanged()
    }
  }

  private notifyStatusChanged(): void {
    const status = this.getStatus()
    try {
      const windows = electron.BrowserWindow?.getAllWindows?.() || []
      for (const win of windows) {
        if (!win.isDestroyed() && win.webContents) {
          win.webContents.send('discord:status-changed', status)
        }
      }
    } catch (err) {
      logger.debug?.('DISCORD', `Failed to broadcast discord status: ${String(err)}`)
    }
  }

  private sendPacket(opcode: Opcode, payloadStr: string): void {
    if (!this.socket || this.socket.destroyed) {
      return
    }

    const payload = Buffer.from(payloadStr, 'utf-8')
    const header = Buffer.alloc(8)
    header.writeUInt32LE(opcode, 0)
    header.writeUInt32LE(payload.length, 4)

    try {
      this.socket.write(Buffer.concat([header, payload]))
    } catch (err) {
      logger.warn('DISCORD', `Failed to send Discord IPC frame: ${String(err)}`)
    }
  }

  private sendHandshake(): void {
    const payload = JSON.stringify({
      v: 1,
      client_id: this.clientId
    })
    this.sendPacket(Opcode.HANDSHAKE, payload)
  }

  private handlePacket(opcode: number, payloadStr: string): void {
    if (opcode === Opcode.PING) {
      this.sendPacket(Opcode.PONG, payloadStr)
      return
    }

    if (opcode === Opcode.CLOSE) {
      this.handleSocketClosed()
      return
    }

    if (opcode === Opcode.FRAME) {
      try {
        const frame = JSON.parse(payloadStr)
        if (frame.cmd === 'DISPATCH' && frame.evt === 'READY') {
          this.isConnected = true
          this.discordUser = frame.data?.user || null
          logger.info(
            'DISCORD',
            `Discord Presence active as @${this.discordUser?.username || 'user'}`
          )
          this.notifyStatusChanged()
          if (this.pendingActivity) {
            this.sendActivityToDiscord(this.pendingActivity)
          }
        } else if (frame.evt === 'ERROR') {
          logger.warn('DISCORD', `Discord returned error: ${JSON.stringify(frame.data)}`)
        }
      } catch {
        // Ignore json parse error
      }
    }
  }

  private sendActivityToDiscord(activity: Record<string, unknown> | null): void {
    this.pendingActivity = activity

    if (!this.isConnected || !this.socket || this.socket.destroyed) {
      return
    }

    const nonce = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const frame = JSON.stringify({
      cmd: 'SET_ACTIVITY',
      args: {
        pid: process.pid,
        activity: activity
      },
      nonce
    })

    this.sendPacket(Opcode.FRAME, frame)
  }

  /**
   * Formats and submits the active learning status to Discord
   */
  public updateActivity(payload?: DiscordActivityPayload): void {
    const settings = SettingsManager.getInstance().getSettings()

    if (!settings.enableDiscordPresence) {
      this.clearActivity()
      return
    }

    if (payload) {
      this.lastPayload = payload
    } else if (this.lastPayload) {
      payload = this.lastPayload
    } else {
      payload = { status: 'idle' }
    }

    const platformRaw = payload.platformId || 'udemy'
    const platform = platformRaw.charAt(0).toUpperCase() + platformRaw.slice(1)

    let details = 'Learning with Udeler Reborn'
    let state = 'Active'

    if (payload.status === 'downloading') {
      const courseTitle =
        settings.showCourseTitleOnDiscord && payload.courseTitle
          ? payload.courseTitle
          : `${platform} Course`
      details = 'Learning with Udeler Reborn'
      if (payload.progressPercent !== undefined) {
        const lecture =
          payload.currentLecture && payload.totalLectures
            ? `Lecture ${payload.currentLecture}/${payload.totalLectures} • `
            : ''
        state = `${courseTitle} (${lecture}${payload.progressPercent}%)`
      } else {
        state = `${courseTitle} • ${platform}`
      }
    } else if (payload.status === 'browsing') {
      details = 'Learning with Udeler Reborn'
      state = `Browsing ${platform} Courses`
    } else if (payload.status === 'settings') {
      details = 'Learning with Udeler Reborn'
      state = 'Configuring Preferences'
    } else {
      details = payload.detailsText || 'Learning with Udeler Reborn'
      state = payload.stateText || `Active on ${platform}`
    }

    const activity: Record<string, unknown> = {
      type: 3,
      details: details.slice(0, 128),
      state: state.slice(0, 128),
      timestamps: {
        start: this.startTimestamp
      },
      assets: {
        large_image: 'udeler_logo',
        large_text: 'Udeler Reborn v4.0.0',
        small_image: platformRaw,
        small_text: platform
      },
      buttons: [
        {
          label: 'Get Udeler Reborn',
          url: 'https://github.com/M3rcena/Udeler-Reborn'
        }
      ],
      instance: true
    }

    this.currentActivityDetails = details

    if (!this.isConnected) {
      this.pendingActivity = activity
      this.connect()
    } else {
      this.sendActivityToDiscord(activity)
    }
  }

  public clearActivity(): void {
    this.pendingActivity = null
    this.currentActivityDetails = undefined
    if (this.isConnected && this.socket && !this.socket.destroyed) {
      this.sendActivityToDiscord(null)
    }
  }

  public disconnect(): void {
    if (this.socket && !this.socket.destroyed) {
      try {
        this.socket.destroy()
      } catch {
        // Ignore
      }
    }
    this.socket = null
    this.isConnected = false
    this.discordUser = null
  }

  public startHeartbeat(): void {
    if (this.heartbeatInterval) return

    // Every 20 seconds, attempt to reconnect if enabled and not currently connected
    this.heartbeatInterval = setInterval(() => {
      const settings = SettingsManager.getInstance().getSettings()
      if (settings.enableDiscordPresence && !this.isConnected && !this.isConnecting) {
        this.connect().then((ok) => {
          if (ok) {
            this.updateActivity()
          }
        })
      }
    }, 20000)
  }

  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Adapts runtime behavior dynamically when user updates app preferences
   */
  public applySettings(settings: AppSettings): void {
    const desiredClientId =
      settings.discordClientId && settings.discordClientId.trim()
        ? settings.discordClientId.trim()
        : DEFAULT_DISCORD_CLIENT_ID

    const clientIdChanged = desiredClientId !== this.clientId
    this.clientId = desiredClientId

    if (settings.enableDiscordPresence) {
      this.startHeartbeat()
      if (clientIdChanged && this.socket) {
        this.disconnect()
      }

      if (!this.isConnected) {
        this.connect().then((ok) => {
          if (ok) {
            this.updateActivity()
          }
        })
      } else {
        this.updateActivity()
      }
    } else {
      this.stopHeartbeat()
      this.clearActivity()
      this.disconnect()
    }
  }

  public destroy(): void {
    this.stopHeartbeat()
    this.clearActivity()
    this.disconnect()
    DiscordRpcManager.instance = null
  }
}

/**
 * Registers IPC handlers for Discord Rich Presence
 */
export function registerDiscordIpc(manager: DiscordRpcManager): void {
  const { ipcMain } = electron

  ipcMain.handle('discord:get-status', (): DiscordPresenceStatus => {
    return manager.getStatus()
  })

  ipcMain.handle('discord:update-activity', (_event, payload?: DiscordActivityPayload): void => {
    manager.updateActivity(payload)
  })

  ipcMain.handle('discord:clear-activity', (): void => {
    manager.clearActivity()
  })
}
