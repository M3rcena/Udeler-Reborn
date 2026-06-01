import { app, shell, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Store from 'electron-store'
import { fetchCourseCurriculum, fetchSubscribedCourses } from './udemy'
import {
  cancelDownload,
  deleteLectureFile,
  DownloadRequest,
  pauseDownload,
  processDownload,
  scanExistingDownloads
} from './download'
import * as fs from 'fs-extra'
import * as path from 'path'

interface SafeStore {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
  delete: (key: string) => void
}

interface SubtitleTrack {
  label: string
  path: string
}

interface DownloadedFile {
  course: string
  chapter: string
  file: string
  path: string
  type: 'Video' | 'Article' | 'File'
  size: number
  subtitles?: SubtitleTrack[]
}

interface AppSettings {
  downloadPath: string
  videoQuality: string
  skipAttachments: boolean
  skipSubtitles: boolean
  autoRetry: boolean
}

// --- GLOBAL ERROR LOGGER ---
const debugLogs: string[] = []

const originalConsoleError = console.error
console.error = (...args) => {
  const timestamp = new Date().toISOString()
  // Safely stringify objects or strings
  const message = args
    .map((a) =>
      typeof a === 'object' && a !== null
        ? JSON.stringify(a, Object.getOwnPropertyNames(a))
        : String(a)
    )
    .join(' ')

  debugLogs.push(`[ERROR] [${timestamp}] ${message}`)
  originalConsoleError(...args) // Still print to your local terminal
}

// Catch unexpected crashes that bypass try/catch blocks
process.on('uncaughtException', (error) => {
  console.error('UncaughtException:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('UnhandledRejection:', reason)
})

const StoreClass = (Store as unknown as { default: new () => unknown }).default || Store

const store = new (StoreClass as new () => unknown)() as unknown as SafeStore

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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
    mainWindow.maximize()
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
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
  })

  ipcMain.handle('store-delete', (_event, key: string): void => {
    store.delete(key)
  })

  ipcMain.handle('fetch-courses', async (): Promise<unknown> => {
    const token = store.get('udemy_token') as string | undefined

    if (!token) {
      throw new Error('No token found')
    }

    const courses = await fetchSubscribedCourses(token)
    return courses
  })

  ipcMain.handle('fetch-curriculum', async (_event, courseId: number): Promise<unknown> => {
    const token = store.get('udemy_token') as string | undefined
    if (!token) throw new Error('No token found')

    return await fetchCourseCurriculum(token, courseId)
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
        autoRetry: settings.autoRetry ?? false
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

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
