import { BrowserWindow } from 'electron'
import * as fs from 'fs'
import { getAllVolumes, getCourseVolumeMappings, updateVolumeStatus } from './database/db'

let watcherInterval: NodeJS.Timeout | null = null

export function startVolumeWatcher(mainWindow: BrowserWindow): void {
  if (watcherInterval) clearInterval(watcherInterval)

  watcherInterval = setInterval((): void => {
    const volumes = getAllVolumes()
    let changed = false

    for (const vol of volumes) {
      const currentlyAvailable = fs.existsSync(vol.root_path)
      const statusInt = currentlyAvailable ? 1 : 0

      if (vol.is_available !== statusInt) {
        updateVolumeStatus(vol.id, statusInt)
        changed = true
      }
    }

    if (changed) {
      const newMappings = getCourseVolumeMappings()
      mainWindow.webContents.send('volume-mappings-updated', newMappings)
    }
  }, 5000)
}
