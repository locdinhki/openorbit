import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC } from '@openorbit/core/ipc-channels'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('Updater')

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours
const STARTUP_DELAY_MS = 5_000 // 5 seconds

export class Updater {
  private mainWindow: BrowserWindow | null = null
  private startupTimeout: ReturnType<typeof setTimeout> | null = null
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private isAutomationRunning: () => boolean

  constructor(opts: { isAutomationRunning: () => boolean }) {
    this.isAutomationRunning = opts.isAutomationRunning
  }

  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow

    autoUpdater.logger = {
      info: (msg: string) => log.info(msg),
      warn: (msg: string) => log.warn(msg),
      error: (msg: string) => log.error(msg),
      debug: (msg: string) => log.debug(msg)
    }
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false

    autoUpdater.on('update-available', (info) => {
      log.info(`Update available: v${info.version}`)
      this.sendToRenderer(IPC.UPDATE_AVAILABLE, {
        version: info.version,
        releaseNotes:
          typeof info.releaseNotes === 'string' ? info.releaseNotes : info.releaseName || ''
      })
    })

    autoUpdater.on('update-downloaded', (info) => {
      log.info(`Update downloaded: v${info.version}`)
      this.sendToRenderer(IPC.UPDATE_READY, { version: info.version })
    })

    autoUpdater.on('error', (err) => {
      log.error('Auto-update error', err)
    })

    // Check after startup delay
    this.startupTimeout = setTimeout(() => this.checkForUpdates(), STARTUP_DELAY_MS)

    // Periodic checks
    this.checkInterval = setInterval(() => this.checkForUpdates(), CHECK_INTERVAL_MS)

    log.info('Auto-updater initialized')
  }

  checkForUpdates(): void {
    if (this.isAutomationRunning()) {
      log.debug('Skipping update check — automation is running')
      return
    }

    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Update check failed', err)
    })
  }

  downloadUpdate(): void {
    log.info('User requested update download')
    autoUpdater.downloadUpdate().catch((err) => {
      log.error('Update download failed', err)
    })
  }

  installUpdate(): void {
    log.info('Installing update and restarting')
    autoUpdater.quitAndInstall(false, true)
  }

  destroy(): void {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout)
      this.startupTimeout = null
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  private sendToRenderer(channel: string, data: Record<string, unknown>): void {
    try {
      this.mainWindow?.webContents.send(channel, data)
    } catch {
      /* window may be closed */
    }
  }
}
