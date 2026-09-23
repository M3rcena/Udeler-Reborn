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

  /**
   * Attempts to extract dynamic user identity directly from the in-memory window state
   */
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
              // 1. Direct inspection of ApplicationStore.userData
              const appStore = window.App?.context?.dispatcher?.stores?.ApplicationStore;
              if (appStore?.userData) {
                const ud = appStore.userData;
                const name = ud.fullName || ud.full_name || ud.display_name || ud.email_address;
                if (name && typeof name === 'string' && name.trim()) return name.trim();
              }

              // 2. Direct inspection of coursera.user
              if (window.coursera?.user) {
                const u = typeof window.coursera.user === 'function' ? window.coursera.user() : window.coursera.user;
                if (u) {
                  const name = u.full_name || u.fullName || u.display_name || u.email_address;
                  if (name && typeof name === 'string' && name.trim()) return name.trim();
                }
              }

              // 3. Apollo GraphQL cache state
              if (window.__APOLLO_STATE__) {
                const apollo = window.__APOLLO_STATE__;
                const lp = apollo['LearnerProfileQueries:{}']?.me;
                if (lp?.fullName && typeof lp.fullName === 'string' && lp.fullName.trim()) {
                  return lp.fullName.trim();
                }
                const rootQuery = apollo['ROOT_QUERY'];
                if (rootQuery) {
                  for (const key of Object.keys(rootQuery)) {
                    if (key.startsWith('FindUserEmailsByUserIdResponse')) {
                      const emails = rootQuery[key]?.userEmails;
                      if (emails && emails[0]?.emailAddress) {
                        return emails[0].emailAddress.trim();
                      }
                    }
                  }
                }
              }

              // 4. Form inputs (if rendered on account-settings)
              const nameInput = document.getElementById('settings-basic-full-name') || document.querySelector('input[name="fullName"]');
              if (nameInput && nameInput.value && nameInput.value.trim()) {
                return nameInput.value.trim();
              }

              // 5. Profile header avatar / dropdown label
              const headerBtn = document.querySelector('[data-e2e="header-profile"]');
              if (headerBtn) {
                const aria = headerBtn.getAttribute('aria-label');
                if (aria && aria.includes('for ')) {
                  const parsed = aria.split('for ')[1].trim();
                  if (parsed) return parsed;
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
              const nextScript = document.getElementById('__NEXT_DATA__');
              if (nextScript?.textContent) {
                const nextData = JSON.parse(nextScript.textContent);
                const auth = nextData?.props?.authContext;
                if (auth?.username) return auth.username;
                if (auth?.email) return auth.email;
              }
      
              const avatarImg = document.querySelector('img[alt]:not([alt=""]):not([alt*="Skillshare"])');
              if (avatarImg) {
                const alt = avatarImg.getAttribute('alt')?.replace(/\s*avatar\s*/i, '').trim();
                if (alt) return alt;
              }

              if (Array.isArray(window.dataLayer)) {
                for (const item of window.dataLayer) {
                  if (item?.customerRawEmail && typeof item.customerRawEmail === 'string') {
                    return item.customerRawEmail.trim();
                  }
                }
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
            'https://www.coursera.org/api/adminUserPermissions.v1?q=my&includes=user',
            { headers }
          )
          if (permRes.ok) {
            const permData = (await permRes.json()) as {
              linked?: { 'users.v1'?: Array<{ fullName?: string; email?: string }> }
            }
            const linked = permData.linked?.['users.v1']?.[0]
            if (linked?.fullName || linked?.email) {
              return linked.fullName || linked.email!
            }
          }
        } catch {}

        try {
          const memRes = await net.fetch('https://www.coursera.org/api/memberships.v1?q=me', {
            headers
          })
          if (memRes.ok) {
            const memData = (await memRes.json()) as {
              linked?: { 'users.v1'?: Array<{ fullName?: string; email?: string }> }
            }
            const user = memData.linked?.['users.v1']?.[0]
            if (user?.fullName || user?.email) {
              return user.fullName || user.email!
            }
          }
        } catch {}
      } else if (platformId === 'skillshare') {
        const userIdCookie = Object.keys(cookieMap).find((k) => k.startsWith('skillshare_user_'))
        const userId = userIdCookie
          ? userIdCookie.replace('skillshare_user_', '')
          : cookieMap['api_uid']

        if (userId) {
          return `User ${userId}`
        }
        return 'Skillshare Member'
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
        targetUrl =
          'https://www.skillshare.com/auth0/login?connection_hint=&final_destination_uri=%2Fen%2F&lang=en&error_destination_uri=%2Flogin'
        break
      case 'edx':
        targetUrl = 'https://courses.edx.org/login'
        break
    }

    const partition = `persist:auth_${platformId}`
    const authSession = session.fromPartition(partition)

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

          if (
            platformId === 'skillshare' &&
            (currentUrl.includes('auth.skillshare.com') ||
              currentUrl.includes('/auth0/login') ||
              currentUrl.includes('/auth0/callback'))
          ) {
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
            const hasSkillshareUser = Object.keys(cookieMap).some((k) =>
              k.startsWith('skillshare_user')
            )
            const hasAccessToken = Boolean(cookieMap['access_token'])

            if (
              (hasAccessToken || hasSkillshareUser) &&
              !currentUrl.includes('/login') &&
              !currentUrl.includes('/auth0/')
            ) {
              extractedToken = cookieMap['access_token'] || cookieMap['PHPSESSID'] || ''
            }
          } else if (
            platformId === 'edx' &&
            (cookieMap['edx-jwt-info'] || cookieMap['edxloggedin'])
          ) {
            extractedToken = cookieMap['edx-jwt-info'] || cookieMap['edxloggedin']
          }

          if (extractedToken && !isResolved) {
            let realUsername: string | null = null
            for (let i = 0; i < 8; i++) {
              if (loginWin.isDestroyed()) break
              realUsername = await this.extractWindowIdentity(loginWin, platformId)
              if (realUsername) break
              await new Promise((r) => setTimeout(r, 250))
            }

            if (platformId === 'coursera' && !realUsername && !loginWin.isDestroyed()) {
              try {
                await loginWin.loadURL('https://www.coursera.org/account-settings')
                for (let i = 0; i < 8; i++) {
                  if (loginWin.isDestroyed()) break
                  realUsername = await this.extractWindowIdentity(loginWin, platformId)
                  if (realUsername) break
                  await new Promise((r) => setTimeout(r, 250))
                }
              } catch {}
            }

            if (!realUsername) {
              realUsername = await this.fetchProfileName(
                platformId,
                extractedToken,
                fullCookieHeader,
                cookieMap,
                subdomain
              )
            }

            isResolved = true
            cleanup()

            if (!loginWin.isDestroyed()) {
              loginWin.hide()
            }

            const verifiedSession: PlatformSession = {
              platformId,
              username: realUsername || `${platformId} user`,
              token: extractedToken,
              cookies: cookieMap,
              subdomain,
              isBusiness,
              expiresAt: Date.now() + 14 * 24 * 60 * 60 * 1000
            }

            this.activeSessions.set(platformId, verifiedSession)
            this.saveSessionsToDisk()
            logger.info(
              'AUTH',
              `Session authenticated for ${platformId} as ${verifiedSession.username}`
            )

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
        if (triggerCookies.includes(cookie.name) || cookie.name.startsWith('skillshare_user')) {
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
