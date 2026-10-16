import { EventEmitter } from 'node:events'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_DISCORD_CLIENT_ID, DiscordRpcManager } from '../services/DiscordRpcManager'
import { SettingsManager } from '../services/SettingsManager'

// Mock Electron
vi.mock('electron', () => {
  const electronMock = {
    app: {
      getPath: vi.fn(() => path.join(os.tmpdir(), 'udeler-discord-test'))
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => false)
    },
    BrowserWindow: {
      getAllWindows: vi.fn(() => [])
    },
    ipcMain: {
      handle: vi.fn()
    }
  }
  return {
    default: electronMock,
    ...electronMock
  }
})

class MockSocket extends EventEmitter {
  public writtenBuffers: Buffer[] = []
  public destroyed = false

  public setTimeout(_ms: number): this {
    return this
  }

  public write(buf: Buffer): boolean {
    this.writtenBuffers.push(buf)
    return true
  }

  public destroy(): this {
    this.destroyed = true
    this.emit('close')
    return this
  }
}

// Mock net module for Vitest ESM
let activeMockSocket: MockSocket

vi.mock('node:net', () => {
  return {
    default: {
      createConnection: vi.fn(() => {
        setTimeout(() => {
          activeMockSocket.emit('connect')
        }, 5)
        return activeMockSocket
      })
    },
    createConnection: vi.fn(() => {
      setTimeout(() => {
        activeMockSocket.emit('connect')
      }, 5)
      return activeMockSocket
    })
  }
})

describe('DiscordRpcManager Service', () => {
  let mockSocket: MockSocket
  let manager: DiscordRpcManager

  beforeEach(() => {
    SettingsManager.getInstance().updateSettings({ enableDiscordPresence: false })
    mockSocket = new MockSocket()
    activeMockSocket = mockSocket
    manager = DiscordRpcManager.getInstance()
  })

  afterEach(() => {
    manager.destroy()
    vi.restoreAllMocks()
  })

  it('initializes with default status and client ID', () => {
    const status = manager.getStatus()
    expect(status.isConnected).toBe(false)
    expect(status.isEnabled).toBe(false)
  })

  it('performs RPC handshake on connection', async () => {
    const connected = await manager.connect()
    expect(connected).toBe(true)
    expect(mockSocket.writtenBuffers.length).toBeGreaterThan(0)

    // Verify Opcode 0 (Handshake) packet framing
    const firstPacket = mockSocket.writtenBuffers[0]
    const opcode = firstPacket.readUInt32LE(0)
    const length = firstPacket.readUInt32LE(4)
    expect(opcode).toBe(0) // HANDSHAKE
    expect(length).toBeGreaterThan(0)

    const payload = JSON.parse(firstPacket.subarray(8, 8 + length).toString('utf-8'))
    expect(payload.v).toBe(1)
    expect(payload.client_id).toBe(DEFAULT_DISCORD_CLIENT_ID)
  })

  it('handles READY dispatch frame and marks presence connected', async () => {
    await manager.connect()

    // Simulate Discord dispatching READY frame
    const readyData = JSON.stringify({
      cmd: 'DISPATCH',
      evt: 'READY',
      data: {
        v: 1,
        user: { id: '123456789', username: 'CourseLearner' }
      }
    })

    const payloadBuf = Buffer.from(readyData, 'utf-8')
    const header = Buffer.alloc(8)
    header.writeUInt32LE(1, 0) // FRAME
    header.writeUInt32LE(payloadBuf.length, 4)

    mockSocket.emit('data', Buffer.concat([header, payloadBuf]))

    const status = manager.getStatus()
    expect(status.isConnected).toBe(true)
    expect(status.username).toBe('CourseLearner')
  })

  it('formats activity for downloading courses with progress and course title', async () => {
    SettingsManager.getInstance().updateSettings({
      enableDiscordPresence: true,
      showCourseTitleOnDiscord: true
    })

    await manager.connect()

    // Simulate READY
    const readyData = JSON.stringify({
      cmd: 'DISPATCH',
      evt: 'READY',
      data: { user: { username: 'Learner' } }
    })
    const payloadBuf = Buffer.from(readyData, 'utf-8')
    const header = Buffer.alloc(8)
    header.writeUInt32LE(1, 0)
    header.writeUInt32LE(payloadBuf.length, 4)
    mockSocket.emit('data', Buffer.concat([header, payloadBuf]))

    manager.updateActivity({
      platformId: 'udemy',
      courseTitle: 'Python Mega Course',
      status: 'downloading',
      currentLecture: 3,
      totalLectures: 50,
      progressPercent: 25
    })

    const lastWritten = mockSocket.writtenBuffers[mockSocket.writtenBuffers.length - 1]
    const opcode = lastWritten.readUInt32LE(0)
    const length = lastWritten.readUInt32LE(4)
    expect(opcode).toBe(1) // FRAME

    const parsed = JSON.parse(lastWritten.subarray(8, 8 + length).toString('utf-8'))
    expect(parsed.cmd).toBe('SET_ACTIVITY')
    expect(parsed.args.activity.type).toBe(3)
    expect(parsed.args.activity.details).toBe('Learning with Udeler Reborn')
    expect(parsed.args.activity.state).toContain('Python Mega Course')
    expect(parsed.args.activity.state).toContain('Lecture 3/50')
    expect(parsed.args.activity.assets.small_image).toBe('udemy')
  })

  it('hides course title when privacy option is disabled', async () => {
    SettingsManager.getInstance().updateSettings({
      enableDiscordPresence: true,
      showCourseTitleOnDiscord: false
    })

    await manager.connect()

    // Simulate READY
    const readyData = JSON.stringify({
      cmd: 'DISPATCH',
      evt: 'READY',
      data: { user: { username: 'Learner' } }
    })
    const payloadBuf = Buffer.from(readyData, 'utf-8')
    const header = Buffer.alloc(8)
    header.writeUInt32LE(1, 0)
    header.writeUInt32LE(payloadBuf.length, 4)
    mockSocket.emit('data', Buffer.concat([header, payloadBuf]))

    manager.updateActivity({
      platformId: 'coursera',
      courseTitle: 'Machine Learning Specialization',
      status: 'downloading'
    })

    const lastWritten = mockSocket.writtenBuffers[mockSocket.writtenBuffers.length - 1]
    const length = lastWritten.readUInt32LE(4)
    const parsed = JSON.parse(lastWritten.subarray(8, 8 + length).toString('utf-8'))

    expect(parsed.args.activity.type).toBe(3)
    expect(parsed.args.activity.details).toBe('Learning with Udeler Reborn')
    expect(parsed.args.activity.state).toContain('Coursera Course')
    expect(parsed.args.activity.state).not.toContain('Machine Learning')
  })

  it('clears activity and disconnects when disabled in settings', () => {
    manager.applySettings({
      ...SettingsManager.getInstance().getSettings(),
      enableDiscordPresence: false
    })

    expect(manager.getStatus().isConnected).toBe(false)
  })
})
