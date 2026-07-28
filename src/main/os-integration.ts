import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { OsProgressSchema, RecentCourseSchema, TrayTooltipSchema } from './validation/os-schema'

let tray: Tray | null = null

export function setupOSIntegration(mainWindow: BrowserWindow, iconPath: string): void {
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)

  tray.setToolTip('Udeler Reborn - Idle')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Udeler', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow.show()
    }
  })
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
  if (process.platform !== 'win32') return

  try {
    const { title, id } = RecentCourseSchema.parse(rawPayload)
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
  } catch (error) {
    console.error('Invalid jump list payload:', error)
  }
}
