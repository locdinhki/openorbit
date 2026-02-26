import { Notification, BrowserWindow } from 'electron'
import type { CoreNotifier } from '@openorbit/core/core-notifier'
import { IPC } from '@openorbit/core/ipc-channels'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('Notifier')

export type NotificationEvent =
  | 'high_match_job'
  | 'application_complete'
  | 'application_failed'
  | 'circuit_breaker_tripped'
  | 'session_complete'

export interface NotificationPreferences {
  enabled: boolean
  events: Record<NotificationEvent, boolean>
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  events: {
    high_match_job: true,
    application_complete: true,
    application_failed: true,
    circuit_breaker_tripped: true,
    session_complete: true
  }
}

export class Notifier implements CoreNotifier {
  private mainWindow: BrowserWindow | null = null
  private preferences: NotificationPreferences

  constructor(preferences?: Partial<NotificationPreferences>) {
    this.preferences = {
      ...DEFAULT_PREFERENCES,
      ...preferences,
      events: { ...DEFAULT_PREFERENCES.events, ...preferences?.events }
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  updatePreferences(prefs: Partial<NotificationPreferences>): void {
    if (prefs.enabled != null) this.preferences.enabled = prefs.enabled
    if (prefs.events) Object.assign(this.preferences.events, prefs.events)
  }

  isEventEnabled(event: NotificationEvent): boolean {
    return this.preferences.enabled && this.preferences.events[event] !== false
  }

  notifyHighMatchJob(job: { title: string; company: string; matchScore?: number }): void {
    if (!this.isEventEnabled('high_match_job')) return

    const score = job.matchScore != null ? ` (${Math.round(job.matchScore * 100)}% match)` : ''
    this.send({
      title: 'High Match Job Found',
      body: `${job.title} @ ${job.company}${score}`,
      event: 'high_match_job'
    })
  }

  notifyApplicationComplete(job: { title: string; company: string }): void {
    if (!this.isEventEnabled('application_complete')) return

    this.send({
      title: 'Application Submitted',
      body: `Applied to ${job.title} @ ${job.company}`,
      event: 'application_complete'
    })
  }

  notifyApplicationFailed(job: { title: string; company: string }, reason: string): void {
    if (!this.isEventEnabled('application_failed')) return

    this.send({
      title: 'Application Failed',
      body: `${job.title} @ ${job.company}: ${reason}`,
      event: 'application_failed'
    })
  }

  notifyCircuitBreakerTripped(): void {
    if (!this.isEventEnabled('circuit_breaker_tripped')) return

    this.send({
      title: 'Automation Paused',
      body: 'Too many consecutive failures — automation paused automatically.',
      event: 'circuit_breaker_tripped'
    })
  }

  notifySessionComplete(stats: {
    jobsExtracted: number
    jobsAnalyzed: number
    applicationsSubmitted: number
  }): void {
    if (!this.isEventEnabled('session_complete')) return

    this.send({
      title: 'Session Complete',
      body: `Extracted: ${stats.jobsExtracted}, Analyzed: ${stats.jobsAnalyzed}, Applied: ${stats.applicationsSubmitted}`,
      event: 'session_complete'
    })
  }

  private send(opts: { title: string; body: string; event: NotificationEvent }): void {
    try {
      if (!Notification.isSupported()) {
        log.warn('Desktop notifications not supported')
        return
      }

      const notification = new Notification({
        title: opts.title,
        body: opts.body,
        silent: false
      })

      notification.on('click', () => {
        this.focusWindow()
        this.sendNotificationClicked(opts.event)
      })

      notification.show()
      log.debug(`Notification sent: ${opts.title}`)
    } catch (err) {
      log.error('Failed to send notification', err)
    }
  }

  private focusWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore()
    }
    if (!this.mainWindow.isVisible()) {
      this.mainWindow.show()
    }
    this.mainWindow.focus()
  }

  private sendNotificationClicked(event: NotificationEvent): void {
    try {
      this.mainWindow?.webContents.send(IPC.NOTIFICATION_CLICKED, { event })
    } catch {
      /* window may be closed */
    }
  }
}

// Module-level singleton (matches setScheduler pattern)
let notifier: Notifier | null = null

export function setNotifier(n: Notifier): void {
  notifier = n
}

export function getNotifier(): Notifier | null {
  return notifier
}
