import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from 'electron'
import Store from 'electron-store'
import { autoUpdater } from 'electron-updater'
import * as fs from 'fs-extra'
import * as path from 'path'
import { join } from 'path'
import { Worker } from 'worker_threads'
import icon from '../../resources/icon.png?asset'
import {
  AppSettings,
  DownloadedFile,
  DownloadRequest,
  IntegrityIssue,
  SafeStore,
  SearchResult
} from '../preload/ipc-types'
import { getStorageStats, initDb, runGarbageCollector } from './database/db'
import {
  cancelDownload,
  deleteLectureFile,
  pauseDownload,
  processDownload,
  scanExistingDownloads
} from './download'
import { initDownloadScheduler } from './network/scheduler'
import {
  handleSetProgressBar,
  handleSetRecentCourse,
  handleSetTrayTooltip,
  handleUpdateQueueMenu,
  setupOSIntegration
} from './os-integration'
import { handleSearchQuery, rebuildIndex } from './search-service'
import { fetchCourseCurriculum, fetchSubscribedCourses } from './udemy'

// --- GLOBAL ERROR LOGGER ---
const debugLogs: string[] = []
const originalConsoleError = console.error
console.error = (...args) => {
  const timestamp = new Date().toISOString()
  const message = args
    .map((a) =>
      typeof a === 'object' && a !== null
        ? JSON.stringify(a, Object.getOwnPropertyNames(a))
        : String(a)
    )
    .join(' ')
  debugLogs.push(`[ERROR] [${timestamp}] ${message}`)
  originalConsoleError(...args)
}

process.on('uncaughtException', (error) => {
  console.error('UncaughtException:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('UnhandledRejection:', reason)
})

const StoreClass = (Store as unknown as { default: new () => unknown }).default || Store
const store = new (StoreClass as new () => unknown)() as unknown as SafeStore

let mainWindow: BrowserWindow | null = null
let isQuitting = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    autoHideMenuBar: true,
    icon: icon,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.maximize()
    mainWindow!.show()
  })

  mainWindow.on('close', (event) => {
    const settings = store.get('app_settings') as AppSettings | undefined

    if (!isQuitting && settings?.closeToTray) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  setupOSIntegration(mainWindow, icon)
  initDownloadScheduler(mainWindow, store)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createUpdaterWindow(): void {
  const updaterWindow = new BrowserWindow({
    width: 320,
    height: 420,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    icon: icon,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  const updaterHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #09090e;
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.05);
            overflow: hidden;
            -webkit-app-region: drag;
            user-select: none;
          }
          .logo {
            width: 80px;
            height: 80px;
            background: linear-gradient(to top right, #2563eb, #9333ea);
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 24px;
            box-shadow: 0 10px 25px rgba(37, 99, 235, 0.3);
          }
          .title { font-size: 22px; font-weight: 900; margin-bottom: 8px; letter-spacing: -0.5px; }
          .status { font-size: 13px; color: #9ca3af; font-weight: 500; margin-bottom: 24px; }
          .progress-track { width: 220px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden; }
          .progress-fill { height: 100%; background: linear-gradient(to right, #3b82f6, #a855f7); width: 0%; transition: width 0.2s ease-out; }
        </style>
      </head>
      <body>
        <div class="logo">
          <svg style="width: 40px; height: 40px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
        </div>
        <div class="title">Udeler Reborn</div>
        <div class="status" id="status">Checking for updates...</div>
        <div class="progress-track">
          <div class="progress-fill" id="fill"></div>
        </div>
        <script>
          const { ipcRenderer } = require('electron')
          ipcRenderer.on('update-status', (e, text) => { document.getElementById('status').innerText = text })
          ipcRenderer.on('update-progress', (e, percent) => { document.getElementById('fill').style.width = percent + '%' })
        </script>
      </body>
    </html>
  `

  updaterWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(updaterHtml)}`)

  updaterWindow.once('ready-to-show', () => {
    updaterWindow.show()
    autoUpdater.checkForUpdates()
  })

  autoUpdater.on('checking-for-update', () => {
    updaterWindow.webContents.send('update-status', 'Looking for updates...')
  })

  autoUpdater.on('update-available', () => {
    updaterWindow.webContents.send('update-status', 'Update found! Downloading...')
  })

  autoUpdater.on('update-not-available', () => {
    updaterWindow.webContents.send('update-status', 'Starting Udeler...')
    setTimeout(() => {
      updaterWindow.close()
      createWindow()
    }, 1000)
  })

  autoUpdater.on('error', (err) => {
    console.error('Updater Error:', err)
    updaterWindow.webContents.send('update-status', 'Update failed. Starting app...')
    setTimeout(() => {
      updaterWindow.close()
      createWindow()
    }, 1500)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent)
    updaterWindow.webContents.send('update-status', `Downloading... ${percent}%`)
    updaterWindow.webContents.send('update-progress', percent)
  })

  autoUpdater.on('update-downloaded', () => {
    updaterWindow.webContents.send('update-status', 'Ready! Restarting...')
    setTimeout(() => {
      autoUpdater.quitAndInstall()
    }, 1500)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.m3rcena.udeler')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('export-debug-logs', async (): Promise<boolean> => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save Debug Logs',
      defaultPath: 'udeler-debug-logs.txt',
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    })

    if (!canceled && filePath) {
      const header = `=== Udeler Reborn Diagnostic Logs ===\nGenerated: ${new Date().toISOString()}\n\n`
      const logContent =
        debugLogs.length > 0 ? debugLogs.join('\n') : 'No backend errors recorded in this session.'

      fs.writeFileSync(filePath, header + logContent, 'utf-8')
      return true
    }
    return false
  })

  ipcMain.handle('store-get', (_event, key: string): unknown => {
    return store.get(key)
  })

  ipcMain.handle('store-set', (_event, key: string, value: unknown): void => {
    store.set(key, value)
    if (key === 'app_settings') {
      const s = value as AppSettings
      if (s.downloadPath) initDb(s.downloadPath)
    }
  })

  ipcMain.handle('store-delete', (_event, key: string): void => {
    store.delete(key)
  })

  ipcMain.handle('get-storage-stats', (): number => {
    return getStorageStats()
  })

  ipcMain.handle(
    'run-garbage-collector',
    async (): Promise<{ purgedCount: number; freedBytes: number }> => {
      const settings = store.get('app_settings') as AppSettings | undefined
      if (!settings || !settings.downloadPath) return { purgedCount: 0, freedBytes: 0 }
      return runGarbageCollector(settings.downloadPath)
    }
  )

  ipcMain.handle('fetch-courses', async (): Promise<unknown> => {
    const token = store.get('udemy_token') as string | undefined
    const subdomain = store.get('udemy_subdomain') as string | undefined

    if (!token) {
      throw new Error('No token found')
    }

    const courses = await fetchSubscribedCourses(token, subdomain)
    return courses
  })

  ipcMain.handle('fetch-curriculum', async (_event, courseId: number): Promise<unknown> => {
    const token = store.get('udemy_token') as string | undefined
    const subdomain = store.get('udemy_subdomain') as string | undefined

    if (!token) throw new Error('No token found')

    return await fetchCourseCurriculum(token, courseId, subdomain)
  })

  ipcMain.handle('select-folder', async (): Promise<string | null> => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Download Folder'
    })

    if (!canceled && filePaths.length > 0) {
      return filePaths[0]
    }
    return null
  })

  ipcMain.handle(
    'start-download',
    async (
      _event,
      req: Omit<DownloadRequest, 'token' | 'downloadPath' | 'videoQuality'>
    ): Promise<string> => {
      const token = store.get('udemy_token') as string | undefined
      const settings = store.get('app_settings') as AppSettings | undefined

      if (!token) throw new Error('No token found')
      if (!settings || !settings.downloadPath) throw new Error('No download path set in settings!')

      const fullRequest: DownloadRequest = {
        ...req,
        token,
        downloadPath: settings.downloadPath,
        videoQuality: settings.videoQuality || 'Auto',
        skipAttachments: settings.skipAttachments ?? false,
        skipSubtitles: settings.skipSubtitles ?? false,
        autoRetry: settings.autoRetry ?? false,
        maxKbps: settings.maxKbps || 0
      }

      return await processDownload(fullRequest)
    }
  )

  ipcMain.handle('get-all-downloads', async () => {
    const settings = store.get('app_settings') as AppSettings | undefined
    if (!settings || !settings.downloadPath) return []

    const results: DownloadedFile[] = []
    if (!fs.existsSync(settings.downloadPath)) return results

    const courses = fs.readdirSync(settings.downloadPath)
    for (const course of courses) {
      const coursePath = path.join(settings.downloadPath, course)
      if (!fs.statSync(coursePath).isDirectory()) continue

      const chapters = fs.readdirSync(coursePath)
      for (const chapter of chapters) {
        const chapterPath = path.join(coursePath, chapter)
        if (!fs.statSync(chapterPath).isDirectory()) continue

        const files = fs.readdirSync(chapterPath)
        const vttFiles = files.filter((f) => f.endsWith('.vtt'))

        for (const file of files) {
          if (file.endsWith('.vtt')) continue

          const filePath = path.join(chapterPath, file)
          const type = file.endsWith('.mp4') ? 'Video' : file.endsWith('.html') ? 'Article' : 'File'

          const stat = fs.statSync(filePath)
          const sizeMB = Math.round(stat.size / (1024 * 1024))

          const item: DownloadedFile = {
            course,
            chapter,
            file,
            path: filePath,
            type,
            size: sizeMB
          }

          if (type === 'Video') {
            const baseName = file.replace('.mp4', '')
            item.subtitles = vttFiles
              .filter((vtt) => vtt.startsWith(baseName))
              .map((vtt) => {
                let label = vtt.replace(baseName + '_', '').replace('.vtt', '')
                label = label.replace('.autogenerated', ' (Auto)')
                if (label === vtt.replace('.vtt', '')) label = 'English (Auto)'

                let srcLang = 'en' // Default fallback
                const lower = label.toLowerCase()

                if (lower.includes('es_') || lower.includes('spanish')) srcLang = 'es'
                else if (lower.includes('pt_') || lower.includes('portuguese')) srcLang = 'pt'
                else if (lower.includes('fr_') || lower.includes('french')) srcLang = 'fr'
                else if (lower.includes('de_') || lower.includes('german')) srcLang = 'de'
                else if (lower.includes('it_') || lower.includes('italian')) srcLang = 'it'
                else if (lower.includes('ja_') || lower.includes('japanese')) srcLang = 'ja'
                else if (lower.includes('zh_') || lower.includes('chinese')) srcLang = 'zh'
                else if (lower.includes('ar_') || lower.includes('arabic')) srcLang = 'ar'
                else {
                  const match = label.match(/^([a-zA-Z]{2})[_-]/)
                  if (match) srcLang = match[1].toLowerCase()
                }

                const vttPath = path.join(chapterPath, vtt)
                let vttContent = fs.readFileSync(vttPath, 'utf8')
                vttContent = vttContent.replace(/^\uFEFF/, '').trim()
                if (!vttContent.startsWith('WEBVTT')) {
                  vttContent = 'WEBVTT\n\n' + vttContent
                }

                const base64Vtt = Buffer.from(vttContent).toString('base64')
                const dataUri = `data:text/vtt;charset=utf-8;base64,${base64Vtt}`

                return { label, srcLang, path: dataUri }
              })
          }

          results.push(item)
        }
      }
    }
    return results
  })

  ipcMain.handle(
    'check-local-downloads',
    async (_event, courseTitle: string): Promise<Record<number, string>> => {
      const settings = store.get('app_settings') as AppSettings | undefined
      if (!settings || !settings.downloadPath) return {}

      return scanExistingDownloads(settings.downloadPath, courseTitle)
    }
  )

  ipcMain.handle('delete-course-folder', async (_event, courseTitle: string): Promise<boolean> => {
    const settings = store.get('app_settings') as { downloadPath?: string } | undefined
    if (!settings || !settings.downloadPath) throw new Error('No download path found')

    const cleanCourseName = courseTitle.replace(/[<>:"/\\|?*]+/g, '-').trim()
    const courseFolder = path.join(settings.downloadPath, cleanCourseName)

    if (fs.existsSync(courseFolder)) {
      fs.rmSync(courseFolder, { recursive: true, force: true })
      return true
    }
    return false
  })

  ipcMain.handle('cancel-download', async (_event, lectureId: number): Promise<boolean> => {
    return cancelDownload(lectureId)
  })

  ipcMain.handle('pause-download', (_, lectureId) => pauseDownload(lectureId))

  ipcMain.handle('moveDownloadsFolder', async (_, oldPath: string, newPath: string) => {
    try {
      if (await fs.pathExists(oldPath)) {
        await fs.move(oldPath, newPath, { overwrite: true })
      }
      return true
    } catch (error) {
      console.error('Failed to move directory:', error)
      throw error
    }
  })

  protocol.registerFileProtocol('local', (request, callback) => {
    const url = request.url.slice('local://'.length)
    const decodedPath = decodeURIComponent(url)
    callback({ path: decodedPath })
  })

  ipcMain.handle(
    'delete-lecture',
    async (_event, courseTitle: string, lectureId: number): Promise<boolean> => {
      const settings = store.get('app_settings') as AppSettings | undefined
      if (!settings || !settings.downloadPath) return false
      return deleteLectureFile(settings.downloadPath, courseTitle, lectureId)
    }
  )

  ipcMain.handle('delete-file-by-path', async (_event, filePath: string): Promise<boolean> => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
    return false
  })

  ipcMain.handle('login-udemy', async (_event, subdomain?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const targetUrl = subdomain
        ? `https://${subdomain}.udemy.com`
        : 'https://www.udemy.com/join/login-popup/'

      const loginWindow = new BrowserWindow({
        width: 600,
        height: 750,
        title: subdomain ? `Sign in to Udemy Business (${subdomain})` : 'Sign in to Udemy',
        autoHideMenuBar: true,
        alwaysOnTop: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      loginWindow.loadURL(targetUrl)

      const checkCookies = async (): Promise<void> => {
        try {
          let cookies = await loginWindow.webContents.session.cookies.get({
            url: targetUrl,
            name: 'access_token'
          })

          if (!cookies || cookies.length === 0) {
            cookies = await loginWindow.webContents.session.cookies.get({
              domain: '.udemy.com',
              name: 'access_token'
            })
          }

          if (cookies && cookies.length > 0) {
            const token = cookies[0].value

            store.set('udemy_token', token)
            if (subdomain) {
              store.set('udemy_subdomain', subdomain)
            } else {
              store.delete('udemy_subdomain')
            }

            clearInterval(cookieInterval)
            loginWindow.close()
            resolve(token)
          }
        } catch (error) {
          console.error('Failed to read cookies:', error)
        }
      }

      const cookieInterval = setInterval(checkCookies, 1500)

      loginWindow.on('closed', () => {
        clearInterval(cookieInterval)
        resolve(null)
      })
    })
  })

  ipcMain.handle('os-set-progress', (_event, progress: number): boolean => {
    if (mainWindow) handleSetProgressBar(mainWindow, progress)
    return true
  })

  ipcMain.handle('os-set-tray-tooltip', (_event, text: string): boolean => {
    handleSetTrayTooltip(text)
    return true
  })

  ipcMain.handle(
    'os-set-recent-course',
    (_event, payload: { title: string; id: number }): boolean => {
      handleSetRecentCourse(payload)
      return true
    }
  )

  ipcMain.handle('os-hide-to-tray', (): boolean => {
    if (mainWindow) mainWindow.hide()
    return true
  })

  ipcMain.handle(
    'os-update-queue-menu',
    (_event, status: 'idle' | 'running' | 'paused'): boolean => {
      handleUpdateQueueMenu(status)
      return true
    }
  )

  ipcMain.handle('os-show-item-in-folder', (_event, filePath: string): void => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('search-index', (_event, query: string): SearchResult[] => {
    return handleSearchQuery(query)
  })

  ipcMain.handle('rebuild-search-index', async (): Promise<boolean> => {
    return await rebuildIndex(store)
  })

  ipcMain.handle('start-integrity-scan', async (event): Promise<IntegrityIssue[]> => {
    const settings = store.get('app_settings') as AppSettings | undefined
    if (!settings?.downloadPath) return []

    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'integrity-worker.js'), {
        workerData: { downloadPath: settings.downloadPath }
      })

      worker.on('message', (msg) => {
        if (msg.type === 'progress') {
          event.sender.send('integrity-progress', msg.data)
        } else if (msg.type === 'done') {
          resolve(msg.issues)
        } else if (msg.type === 'error') {
          reject(new Error(msg.error))
        }
      })

      worker.on('error', reject)
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`))
      })
    })
  })

  const settings = store.get('app_settings') as AppSettings | undefined
  if (settings?.downloadPath) {
    initDb(settings.downloadPath)
  }

  if (is.dev) {
    createWindow()
  } else {
    createUpdaterWindow()
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (is.dev) createWindow()
      else createUpdaterWindow()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
