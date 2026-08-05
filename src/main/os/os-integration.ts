import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { DownloadedFile } from '../../preload/types/ipc-types'
import { OsProgressSchema, RecentCourseSchema, TrayTooltipSchema } from '../validation/os-schema'
import { appVersion } from '../version'

let tray: Tray | null = null
let currentMainWindow: BrowserWindow | null = null
let lastRecentCourse: { title: string; id: number; file?: DownloadedFile } | null = null
let lastQueueStatus: 'idle' | 'running' | 'paused' = 'idle'

function rebuildTrayMenu(): void {
  if (!tray) return

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    { label: `Udeler Reborn ${appVersion}` },
    { type: 'separator' }
  ]

  if (lastRecentCourse) {
    menuTemplate.push(
      {
        label: `  Continue Watching: ${lastRecentCourse.title}`,
        click: () => {
          currentMainWindow?.show()
          if (lastRecentCourse?.file) {
            currentMainWindow?.webContents.send('play-recent-media', lastRecentCourse.file)
          } else {
            currentMainWindow?.webContents.send('navigate-course', lastRecentCourse!.id)
          }
        }
      },
      { type: 'separator' }
    )
  }

  if (lastQueueStatus !== 'idle') {
    if (lastQueueStatus === 'running') {
      menuTemplate.push({
        label: '⏸ Pause Downloads',
        click: () => currentMainWindow?.webContents.send('tray-action', 'pause')
      })
    } else if (lastQueueStatus === 'paused') {
      menuTemplate.push({
        label: '▶ Resume Downloads',
        click: () => currentMainWindow?.webContents.send('tray-action', 'resume')
      })
    }
    menuTemplate.push(
      {
        label: '⏹ Stop & Clear Queue',
        click: () => currentMainWindow?.webContents.send('tray-action', 'cancel')
      },
      { type: 'separator' }
    )
  }

  menuTemplate.push({ label: 'Quit', click: () => app.quit() })
  tray.setContextMenu(Menu.buildFromTemplate(menuTemplate))
}

export function setupOSIntegration(mainWindow: BrowserWindow, iconPath: string): void {
  currentMainWindow = mainWindow
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

  tray = new Tray(trayIcon)
  tray.setToolTip('Udeler Reborn - Idle')
  rebuildTrayMenu()

  tray.on('click', () => {
    if (mainWindow.isVisible()) mainWindow.focus()
    else mainWindow.show()
  })
}

export function handleUpdateQueueMenu(status: 'idle' | 'running' | 'paused'): void {
  lastQueueStatus = status
  rebuildTrayMenu()
}

export function handleSetProgressBar(mainWindow: BrowserWindow, rawProgress: unknown): void {
  try {
    const { progress } = OsProgressSchema.parse({ progress: rawProgress })
    mainWindow.setProgressBar(progress)
  } catch (error) {
    console.error('Invalid progress payload sent to OS integration:', error)
  }
}

export function handleSetTrayTooltip(rawText: unknown): void {
  try {
    const { text } = TrayTooltipSchema.parse({ text: rawText })
    if (tray) tray.setToolTip(text)
  } catch (error) {
    console.error('Invalid tray tooltip payload:', error)
  }
}

export function handleSetRecentCourse(rawPayload: unknown): void {
  try {
    const { title, id, file } = RecentCourseSchema.parse(rawPayload)
    lastRecentCourse = { title, id, file }

    if (process.platform === 'win32') {
      app.setJumpList([
        {
          type: 'tasks',
          name: 'Recent Courses',
          items: [
            {
              type: 'task',
              title: `Resume: ${title}`,
              program: process.execPath,
              args: `--resume-course=${id}`,
              description: `Continue watching ${title}`
            }
          ]
        }
      ])
    }
    rebuildTrayMenu()
  } catch (error) {
    console.error('Invalid OS payload:', error)
  }
}
