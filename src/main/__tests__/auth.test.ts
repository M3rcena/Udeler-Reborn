import { PlatformSession } from '@shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthManager } from '../auth'

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: true }
}))

vi.mock('electron', () => {
  const electronMock = {
    BrowserWindow: class {
      setMenuBarVisibility = vi.fn()
      webContents = {
        on: vi.fn(),
        executeJavaScript: vi.fn().mockResolvedValue('Test Name')
      }
      on = vi.fn()
      loadURL = vi.fn().mockResolvedValue(undefined)
      close = vi.fn()
    },
    session: {
      fromPartition: vi.fn(() => ({
        cookies: {
          get: vi.fn().mockResolvedValue([{ name: 'access_token', value: 'secret_token_123' }])
        }
      }))
    },
    net: {
      fetch: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          display_name: 'Test Name',
          email: 'testemail@gmail.com'
        })
      })
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

describe('AuthManager Automatic Session Lifecycle', () => {
  let auth: AuthManager

  beforeEach(() => {
    auth = new AuthManager()
  })

  it('detects expiring tokens accurately within the 5-minute buffer', () => {
    const expiredSession: PlatformSession = {
      platformId: 'udemy',
      username: 'Test Name',
      token: 'tok_123',
      expiresAt: Date.now() + 2 * 60 * 1000
    }

    const freshSession: PlatformSession = {
      platformId: 'udemy',
      username: 'Test Name',
      token: 'tok_456',
      expiresAt: Date.now() + 60 * 60 * 1000
    }

    expect(auth.isTokenExpiring(expiredSession)).toBe(true)
    expect(auth.isTokenExpiring(freshSession)).toBe(false)
  })

  it('revokes and removes active session on user disconnect', async () => {
    const session: PlatformSession = {
      platformId: 'coursera',
      username: 'Test Name',
      token: 'cauth_sample'
    }
    ;(auth as unknown as { activeSessions: Map<string, PlatformSession> }).activeSessions.set(
      'coursera',
      session
    )

    expect(auth.getSession('coursera')).toBeDefined()
    const removed = await auth.removeSession('coursera')
    expect(removed).toBe(true)
    expect(auth.getSession('coursera')).toBeUndefined()
  })
})
