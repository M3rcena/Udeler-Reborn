import electron from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { logger } from '../shared/logger'
import type { AuthResult, PlatformId, PlatformSession, WebAuthOptions } from '../shared/types'

const { app, BrowserWindow, session, ipcMain, net } = electron

export class AuthManager {
  private activeSessions: Map<PlatformId, PlatformSession> = new Map()
  private storageFilePath: string = ''

  constructor() {
    this.initStoragePath()
    this.loadSessionsFromDisk()
  }

  private initStoragePath(): void {
    try {
      if (app?.getPath) {
        const dir = app.getPath('userData')
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        this.storageFilePath = path.join(dir, 'sessions.json')
        return
      }
    } catch {
      // Fallback
    }
    this.storageFilePath = path.resolve(process.cwd(), 'sessions.json')
  }

  private loadSessionsFromDisk(): void {
    try {
      if (this.storageFilePath && fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8')
        const data = JSON.parse(raw) as Record<string, PlatformSession>
        for (const [key, sess] of Object.entries(data)) {
          this.activeSessions.set(key as PlatformId, sess)
        }
        logger.info('AUTH', `Restored ${this.activeSessions.size} active sessions from disk`)
      }
    } catch (err) {
      logger.error('AUTH', `Failed to load sessions from disk: ${String(err)}`)
    }
  }

  private saveSessionsToDisk(): void {
    try {
      if (!this.storageFilePath) return
      const obj: Record<string, PlatformSession> = {}
      for (const [key, sess] of this.activeSessions.entries()) {
        obj[key] = sess
      }
      fs.writeFileSync(this.storageFilePath, JSON.stringify(obj, null, 2), 'utf-8')
    } catch (err) {
      logger.error('AUTH', `Failed to persist sessions to disk: ${String(err)}`)
    }
  }

  public getSession(platformId: PlatformId): PlatformSession | undefined {
    return this.activeSessions.get(platformId)
  }

  public getAllSessions(): PlatformSession[] {
    return Array.from(this.activeSessions.values())
  }

  public async removeSession(platformId: PlatformId): Promise<boolean> {
    logger.info('AUTH', `Revoking session for platform: ${platformId}`)
    const removed = this.activeSessions.delete(platformId)
    if (removed) {
      this.saveSessionsToDisk()
      try {
        const partition = `persist:auth_${platformId}`
        await session.fromPartition(partition).clearStorageData({
          storages: ['cookies', 'localstorage']
        })
      } catch (err) {
        logger.warn('AUTH', `Could not clear partition storage for ${platformId}: ${String(err)}`)
      }
    }
    return removed
  }

  public isTokenExpiring(session: PlatformSession): boolean {
    if (!session.expiresAt) return false
    const FIVE_MINUTES_MS = 5 * 60 * 1000
    return Date.now() + FIVE_MINUTES_MS >= session.expiresAt
  }

  public async ensureValidToken(platformId: PlatformId): Promise<string | null> {
    const active = this.getSession(platformId)
    if (!active) return null

    if (!this.isTokenExpiring(active)) {
      return active.token
    }

    logger.info('AUTH', `Token expiring for ${platformId}. Checking validity...`)
    return active.token
  }

  private async extractWindowIdentity(
    loginWin: electron.BrowserWindow,
    platformId: PlatformId
  ): Promise<string | null> {
    if (loginWin.isDestroyed()) return null

    try {
      if (platformId === 'coursera') {
        const js = `
          (() => {
            try {
              const appStore = window.App?.context?.dispatcher?.stores?.ApplicationStore;
              if (appStore?.userData) {
                const ud = appStore.userData;
                const name = ud.fullName || ud.full_name || ud.display_name || ud.email_address;
                if (name) return name;
              }

              if (window.coursera?.user) {
                const u = typeof window.coursera.user === 'function' ? window.coursera.user() : window.coursera.user;
                if (u) {
                  const name = u.full_name || u.fullName || u.display_name || u.email_address;
                  if (name) return name;
                }
              }

              if (window.__APOLLO_STATE__) {
                const apollo = window.__APOLLO_STATE__;
                if (apollo['LearnerProfileQueries:{}']?.me?.fullName) {
                  return apollo['LearnerProfileQueries:{}'].me.fullName;
                }
              }

              const nameInput = document.getElementById('settings-basic-full-name') || document.querySelector('input[name="fullName"]');
              if (nameInput && nameInput.value) {
                return nameInput.value.trim();
              }

              const headerBtn = document.querySelector('[data-e2e="header-profile"]');
              if (headerBtn) {
                const aria = headerBtn.getAttribute('aria-label');
                if (aria && aria.includes('for ')) {
                  return aria.split('for ')[1].trim();
                }
              }
            } catch (e) {}
            return null;
          })()
        `
        return (await loginWin.webContents.executeJavaScript(js)) as string | null
      }

      if (platformId === 'skillshare') {
        const js = `
          (() => {
            try {
              if (window.Skillshare && window.Skillshare.currentUser) {
                const u = window.Skillshare.currentUser;
                const name = u.name || u.fullName || u.username || u.email;
                if (name) return name;
              }

              if (window.__INITIAL_STATE__ && window.__INITIAL_STATE__.currentUser) {
                const u = window.__INITIAL_STATE__.currentUser;
                const name = u.name || u.fullName || u.username || u.email;
                if (name) return name;
              }

              const userMenu = document.querySelector('.user-menu-wrapper, [data-testid="user-avatar"], [class*="UserMenu"], .avatar');
              if (userMenu) {
                const alt = userMenu.getAttribute('alt') || userMenu.getAttribute('aria-label');
                if (alt && !alt.toLowerCase().includes('avatar') && !alt.toLowerCase().includes('user')) {
                  return alt.trim();
                }
              }

              const nameEl = document.querySelector('.user-information .name, a[href*="/user/"] span');
              if (nameEl && nameEl.textContent) {
                const text = nameEl.textContent.trim();
                if (text.length > 1 && text.length < 50) return text;
              }
            } catch (e) {}
            return null;
          })()
        `
        return (await loginWin.webContents.executeJavaScript(js)) as string | null
      }
    } catch {
      // Ignored
    }
    return null
  }

  private async fetchProfileName(
    platformId: PlatformId,
    token: string,
    cookieHeader: string,
    cookieMap: Record<string, string>,
    subdomain?: string
  ): Promise<string> {
    try {
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        Cookie: cookieHeader
      }

      if (platformId === 'udemy') {
        const base = subdomain ? `https://${subdomain}.udemy.com` : 'https://www.udemy.com'
        headers['Authorization'] = `Bearer ${token}`
        const res = await net.fetch(
          `${base}/api-2.0/users/me/?fields[user]=title,display_name,email`,
          { headers }
        )
        if (res.ok) {
          const data = (await res.json()) as Record<string, unknown>
          return (
            (data.display_name as string) ||
            (data.title as string) ||
            (data.email as string) ||
            'Udemy Student'
          )
        }
      } else if (platformId === 'coursera') {
        if (cookieMap['CSRF3-Token']) {
          headers['x-csrf3-token'] = cookieMap['CSRF3-Token']
        }

        try {
          const permRes = await net.fetch(
            'https://www.coursera.org/api/adminUserPermissions.v1?q=my',
            { headers }
          )
          if (permRes.ok) {
            const permData = (await permRes.json()) as { elements?: Array<{ id?: string }> }
            const userId = permData.elements?.[0]?.id
            if (userId) {
              return `Learner (${userId})`
            }
          }
        } catch {}
      } else if (platformId === 'skillshare') {
        // Query Skillshare user identity endpoint with authenticated cookies
        const userId =
          cookieMap['skillshare_user_id'] || cookieMap['ss_user_id'] || cookieMap['api_uid']
        try {
          const endpoint = userId
            ? `https://www.skillshare.com/api/users/${userId}`
            : 'https://www.skillshare.com/api/v2/users/me'
          const res = await net.fetch(endpoint, { headers })
          if (res.ok) {
            const data = (await res.json()) as Record<string, unknown>
            const resolved =
              (data.name as string) ||
              (data.first_name && data.last_name
                ? `${data.first_name} ${data.last_name}`
                : undefined) ||
              (data.username as string) ||
              (data.email as string)
            if (resolved) return resolved
          }
        } catch {}

        if (userId) {
          return `Skillshare User (${userId})`
        }
      } else if (platformId === 'edx') {
        if (cookieMap['edx-jwt-info']) {
          try {
            const rawDecoded = Buffer.from(cookieMap['edx-jwt-info'], 'base64').toString('utf-8')
            const parsed = JSON.parse(rawDecoded) as { username?: string; email?: string }
            if (parsed.username || parsed.email) {
              return parsed.username || parsed.email!
            }
          } catch {}
        }

        const res = await net.fetch('https://courses.edx.org/api/user/v1/accounts/', { headers })
        if (res.ok) {
          const data = (await res.json()) as Array<{
            username?: string
            email?: string
            name?: string
          }>
          const user = Array.isArray(data)
            ? data[0]
            : (data as { username?: string; email?: string; name?: string })
          return user?.name || user?.username || user?.email || 'edX Student'
        }
      }
    } catch (err) {
      logger.warn('AUTH', `Failed to fetch profile name for ${platformId}: ${String(err)}`)
    }

    return `${platformId} user`
  }

  public async launchWebAuth(options: WebAuthOptions): Promise<AuthResult> {
    const { platformId, subdomain, isBusiness } = options

    let targetUrl = ''
    switch (platformId) {
      case 'udemy':
        targetUrl =
          isBusiness && subdomain
            ? `https://${subdomain}.udemy.com/join/login-popup/`
            : 'https://www.udemy.com/join/login-popup/'
        break
      case 'coursera':
        targetUrl = 'https://www.coursera.org/?authMode=login'
        break
      case 'skillshare':
        // Start from skillshare.com/signin which redirects to auth.skillshare.com with all required PKCE parameters
        targetUrl = 'https://www.skillshare.com/en/signin'
        break
      case 'edx':
        targetUrl = 'https://courses.edx.org/login'
        break
    }

    const partition = `persist:auth_${platformId}`
    const authSession = session.fromPartition(partition)

    // Clear stale session cookies if previously revoked
    if (!this.getSession(platformId)) {
      await authSession.clearStorageData({ storages: ['cookies', 'localstorage'] })
    }

    authSession.webRequest.onBeforeRequest(
      { urls: ['*://tags.coursera.org/*', '*://*.sentry.io/*', '*://*.segment.io/*'] },
      (_details, callback) => {
        callback({ cancel: true })
      }
    )

    return new Promise((resolve) => {
      const loginWin = new BrowserWindow({
        width: 580,
        height: 740,
        resizable: true,
        minimizable: false,
        maximizable: false,
        title: `Login - ${platformId.toUpperCase()}`,
        webPreferences: {
          session: authSession,
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      loginWin.setMenuBarVisibility(false)
      let isResolved = false
      let pollInterval: NodeJS.Timeout | null = null

      const cleanup = (): void => {
        if (pollInterval) {
          clearInterval(pollInterval)
          pollInterval = null
        }
      }

      const checkAuth = async (): Promise<void> => {
        if (isResolved || loginWin.isDestroyed()) return

        try {
          const currentUrl = loginWin.webContents.getURL()

          // For Skillshare: do not authenticate while still inside the Auth0 auth.skillshare.com domain
          if (platformId === 'skillshare' && currentUrl.includes('auth.skillshare.com')) {
            return
          }

          const cookies = await authSession.cookies.get({})
          const cookieMap: Record<string, string> = {}
          const cookieStrings: string[] = []

          cookies.forEach((c) => {
            cookieMap[c.name] = c.value
            cookieStrings.push(`${c.name}=${c.value}`)
          })

          const fullCookieHeader = cookieStrings.join('; ')
          let extractedToken = ''

          if (platformId === 'udemy' && cookieMap['access_token']) {
            extractedToken = cookieMap['access_token']
          } else if (platformId === 'coursera' && cookieMap['CAUTH']) {
            extractedToken = cookieMap['CAUTH']
          } else if (platformId === 'skillshare') {
            // Only authenticate once redirected back to skillshare.com with valid credentials
            const hasAuthCookie =
              cookieMap['skillshare_user_id'] ||
              cookieMap['ss_user_id'] ||
              cookieMap['api_uid'] ||
              cookieMap['skillshare_user']

            if (hasAuthCookie && !currentUrl.includes('signin') && !currentUrl.includes('login')) {
              extractedToken = cookieMap['PHPSESSID'] || hasAuthCookie
            }
          } else if (
            platformId === 'edx' &&
            (cookieMap['edx-jwt-info'] || cookieMap['edxloggedin'])
          ) {
            extractedToken = cookieMap['edx-jwt-info'] || cookieMap['edxloggedin']
          }

          if (extractedToken && !isResolved) {
            isResolved = true
            cleanup()

            if (!loginWin.isDestroyed()) {
              loginWin.hide()
            }

            let realUsername = await this.extractWindowIdentity(loginWin, platformId)

            if (!realUsername) {
              realUsername = await this.fetchProfileName(
                platformId,
                extractedToken,
                fullCookieHeader,
                cookieMap,
                subdomain
              )
            }

            const verifiedSession: PlatformSession = {
              platformId,
              username: realUsername,
              token: extractedToken,
              cookies: cookieMap,
              subdomain,
              isBusiness,
              expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000
            }

            this.activeSessions.set(platformId, verifiedSession)
            this.saveSessionsToDisk()
            logger.info('AUTH', `Session authenticated for ${platformId} as ${realUsername}`)

            setImmediate(() => {
              if (!loginWin.isDestroyed()) {
                loginWin.close()
              }
            })

            resolve({ success: true, session: verifiedSession })
          }
        } catch (err) {
          logger.error('AUTH', `Cookie inspection error: ${String(err)}`)
        }
      }

      const cookieListener = (
        _event: unknown,
        cookie: electron.Cookie,
        _cause: unknown,
        removed: boolean
      ): void => {
        if (removed || isResolved) return
        const triggerCookies = [
          'access_token',
          'CAUTH',
          'skillshare_user_id',
          'ss_user_id',
          'api_uid',
          'edx-jwt-info',
          'edxloggedin'
        ]
        if (triggerCookies.includes(cookie.name)) {
          checkAuth()
        }
      }
      authSession.cookies.on('changed', cookieListener)

      pollInterval = setInterval(checkAuth, 350)

      loginWin.webContents.on('did-finish-load', () => checkAuth())
      loginWin.webContents.on('did-navigate', () => checkAuth())
      loginWin.webContents.on('did-navigate-in-page', () => checkAuth())

      loginWin.on('closed', () => {
        cleanup()
        authSession.cookies.removeListener('changed', cookieListener)
        if (!isResolved) {
          isResolved = true
          resolve({ success: false, error: 'Authentication window closed before completion' })
        }
      })

      loginWin.loadURL(targetUrl).catch((err: Error & { code?: string; errno?: number }) => {
        if (
          isResolved ||
          err.message.includes('ERR_ABORTED') ||
          err.message.includes('ERR_FAILED')
        ) {
          return
        }
        logger.error('AUTH', `Failed to load login page: ${err.message}`)
      })
    })
  }
}

export function registerAuthIpc(authManager: AuthManager): void {
  ipcMain.handle('auth:get-sessions', () => {
    return authManager.getAllSessions()
  })

  ipcMain.handle('auth:launch-web', async (_event, options: WebAuthOptions) => {
    return authManager.launchWebAuth(options)
  })

  ipcMain.handle('auth:remove-session', async (_event, platformId: PlatformId) => {
    return authManager.removeSession(platformId)
  })

  ipcMain.handle('auth:ensure-valid-token', async (_event, platformId: PlatformId) => {
    return authManager.ensureValidToken(platformId)
  })
}
