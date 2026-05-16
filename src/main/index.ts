import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import Store from 'electron-store'
import { fetchCourseCurriculum, fetchSubscribedCourses } from './udemy'
import { cancelDownload, DownloadRequest, processDownload, scanExistingDownloads } from './download'
import * as fs from 'fs-extra'
import * as path from 'path'

interface SafeStore {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
  delete: (key: string) => void
}

interface AppSettings {
  downloadPath: string
  videoQuality: string
  skipAttachments: boolean
  skipSubtitles: boolean
  autoRetry: boolean
}

const StoreClass = (Store as unknown as { default: new () => unknown }).default || Store

const store = new (StoreClass as new () => unknown)() as unknown as SafeStore

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    autoHideMenuBar: true,
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
    async (_event, req: Omit<DownloadRequest, 'token' | 'downloadPath'>): Promise<string> => {
      const token = store.get('udemy_token') as string | undefined
      const settings = store.get('app_settings') as AppSettings | undefined

      if (!token) throw new Error('No token found')
      if (!settings || !settings.downloadPath) throw new Error('No download path set in settings!')

      const fullRequest: DownloadRequest = {
        ...req,
        token,
        downloadPath: settings.downloadPath
      }

      return await processDownload(fullRequest)
    }
  )

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
