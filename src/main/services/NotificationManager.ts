import { Notification } from 'electron'
import { logger } from '../../shared/logger'
import { SettingsManager } from './SettingsManager'
import { getAppIconPath } from './TrayManager'

export class NotificationManager {
  private static instance: NotificationManager | null = null

  public static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager()
    }
    return NotificationManager.instance
  }

  public static showNotification(
    title: string,
    body: string,
    onClick?: () => void,
    force?: boolean
  ): boolean {
    try {
      const settings = SettingsManager.getInstance().getSettings()

      // If not forced test notification, check user preference
      if (!force && !settings.notifyOnCompletion) {
        logger.debug('NOTIFY', 'Skipping notification: notifyOnCompletion is disabled')
        return false
      }

      if (!Notification.isSupported()) {
        logger.warn('NOTIFY', 'Desktop notifications are not supported on this operating system')
        return false
      }

      const iconPath = getAppIconPath()

      const notification = new Notification({
        title: title || 'Udeler Reborn',
        body: body || 'Download operation completed',
        icon: iconPath,
        silent: false
      })

      if (onClick) {
        notification.on('click', onClick)
      }

      notification.show()
      logger.info('NOTIFY', `Desktop notification displayed: "${title}"`)
      return true
    } catch (err) {
      logger.error('NOTIFY', `Failed to display desktop notification: ${String(err)}`)
      return false
    }
  }
}
