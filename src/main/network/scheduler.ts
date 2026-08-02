import { BrowserWindow } from 'electron'
import { AppSettings, SafeStore } from '../../preload/ipc-types'

let scheduleInterval: NodeJS.Timeout | null = null

export function initDownloadScheduler(mainWindow: BrowserWindow, store: SafeStore): void {
  if (scheduleInterval) clearInterval(scheduleInterval)

  scheduleInterval = setInterval(() => {
    const settings = store.get('app_settings') as AppSettings | undefined
    if (!settings?.scheduleEnabled || !settings?.scheduleStart || !settings?.scheduleEnd) return

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const [startH, startM] = settings.scheduleStart.split(':').map(Number)
    const [endH, endM] = settings.scheduleEnd.split(':').map(Number)

    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    let isWithinWindow = false
    if (startMinutes < endMinutes) {
      isWithinWindow = currentMinutes >= startMinutes && currentMinutes < endMinutes
    } else {
      isWithinWindow = currentMinutes >= startMinutes || currentMinutes < endMinutes
    }

    if (isWithinWindow) {
      mainWindow.webContents.send('schedule-resume')
    } else {
      mainWindow.webContents.send('schedule-pause')
    }
  }, 60000)
}
