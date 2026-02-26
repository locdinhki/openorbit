/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockShow, mockNotificationOn, mockIsSupported, mockSend, MockNotification } = vi.hoisted(
  () => {
    const mockShow = vi.fn()
    const mockNotificationOn = vi.fn()
    const mockIsSupported = vi.fn().mockReturnValue(true)
    const mockSend = vi.fn()
    const MockNotification = vi.fn().mockImplementation(function (this: any) {
      this.show = mockShow
      this.on = mockNotificationOn
    })
    ;(MockNotification as any).isSupported = mockIsSupported

    return { mockShow, mockNotificationOn, mockIsSupported, mockSend, MockNotification }
  }
)

vi.mock('electron', () => ({
  Notification: MockNotification,
  BrowserWindow: vi.fn()
}))

vi.mock('@openorbit/core/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

import { Notifier, setNotifier, getNotifier } from '../notifier'

function makeMockWindow(): any {
  return {
    isDestroyed: vi.fn().mockReturnValue(false),
    isMinimized: vi.fn().mockReturnValue(false),
    isVisible: vi.fn().mockReturnValue(true),
    show: vi.fn(),
    hide: vi.fn(),
    restore: vi.fn(),
    focus: vi.fn(),
    webContents: { send: mockSend }
  }
}

describe('Notifier', () => {
  let notifier: Notifier

  beforeEach(() => {
    vi.clearAllMocks()
    notifier = new Notifier()
    notifier.setMainWindow(makeMockWindow())
  })

  describe('notifyHighMatchJob', () => {
    it('sends a notification for high match jobs', () => {
      notifier.notifyHighMatchJob({ title: 'Senior Dev', company: 'Acme', matchScore: 0.92 })

      expect(mockShow).toHaveBeenCalledOnce()
      expect(MockNotification).toHaveBeenCalledWith({
        title: 'High Match Job Found',
        body: 'Senior Dev @ Acme (92% match)',
        silent: false
      })
    })

    it('omits score when matchScore is undefined', () => {
      notifier.notifyHighMatchJob({ title: 'Dev', company: 'Co' })

      expect(MockNotification).toHaveBeenCalledWith(expect.objectContaining({ body: 'Dev @ Co' }))
    })
  })

  describe('notifyApplicationComplete', () => {
    it('sends a notification for completed applications', () => {
      notifier.notifyApplicationComplete({ title: 'Frontend Dev', company: 'BigCo' })

      expect(mockShow).toHaveBeenCalledOnce()
      expect(MockNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Application Submitted',
          body: 'Applied to Frontend Dev @ BigCo'
        })
      )
    })
  })

  describe('notifyApplicationFailed', () => {
    it('sends a notification with failure reason', () => {
      notifier.notifyApplicationFailed({ title: 'Dev', company: 'Co' }, 'External apply required')

      expect(MockNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Application Failed',
          body: 'Dev @ Co: External apply required'
        })
      )
    })
  })

  describe('notifyCircuitBreakerTripped', () => {
    it('sends a notification when circuit breaker trips', () => {
      notifier.notifyCircuitBreakerTripped()

      expect(MockNotification).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Automation Paused' })
      )
    })
  })

  describe('notifySessionComplete', () => {
    it('sends a notification with session stats', () => {
      notifier.notifySessionComplete({
        jobsExtracted: 15,
        jobsAnalyzed: 12,
        applicationsSubmitted: 3
      })

      expect(MockNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Session Complete',
          body: 'Extracted: 15, Analyzed: 12, Applied: 3'
        })
      )
    })
  })

  describe('preferences', () => {
    it('respects disabled global notifications', () => {
      notifier.updatePreferences({ enabled: false })
      notifier.notifyHighMatchJob({ title: 'Dev', company: 'Co' })

      expect(mockShow).not.toHaveBeenCalled()
    })

    it('respects per-event disabled notifications', () => {
      notifier.updatePreferences({ events: { high_match_job: false } as any })
      notifier.notifyHighMatchJob({ title: 'Dev', company: 'Co' })

      expect(mockShow).not.toHaveBeenCalled()
    })

    it('allows other events when one is disabled', () => {
      notifier.updatePreferences({ events: { high_match_job: false } as any })
      notifier.notifyApplicationComplete({ title: 'Dev', company: 'Co' })

      expect(mockShow).toHaveBeenCalledOnce()
    })

    it('accepts custom preferences in constructor', () => {
      const n = new Notifier({ enabled: false })
      n.setMainWindow(makeMockWindow())
      expect(n.isEventEnabled('high_match_job')).toBe(false)
    })
  })

  describe('notification click', () => {
    it('sends NOTIFICATION_CLICKED IPC on click', () => {
      notifier.notifyHighMatchJob({ title: 'Dev', company: 'Co' })

      const clickHandler = mockNotificationOn.mock.calls.find(
        (call: any[]) => call[0] === 'click'
      )?.[1]
      expect(clickHandler).toBeDefined()

      clickHandler()
      expect(mockSend).toHaveBeenCalledWith('notification:clicked', {
        event: 'high_match_job'
      })
    })

    it('focuses window on click', () => {
      const win = makeMockWindow()
      win.isMinimized.mockReturnValue(true)
      win.isVisible.mockReturnValue(false)
      notifier.setMainWindow(win)

      notifier.notifyHighMatchJob({ title: 'Dev', company: 'Co' })

      const clickHandler = mockNotificationOn.mock.calls.find(
        (call: any[]) => call[0] === 'click'
      )?.[1]
      clickHandler()

      expect(win.restore).toHaveBeenCalled()
      expect(win.show).toHaveBeenCalled()
      expect(win.focus).toHaveBeenCalled()
    })
  })

  describe('unsupported notifications', () => {
    it('does not throw when notifications are unsupported', () => {
      mockIsSupported.mockReturnValueOnce(false)

      expect(() => {
        notifier.notifyHighMatchJob({ title: 'Dev', company: 'Co' })
      }).not.toThrow()
      expect(mockShow).not.toHaveBeenCalled()
    })
  })
})

describe('module-level singleton', () => {
  it('getNotifier returns null by default', () => {
    setNotifier(null as any)
    expect(getNotifier()).toBeNull()
  })

  it('setNotifier/getNotifier round-trips', () => {
    const n = new Notifier()
    setNotifier(n)
    expect(getNotifier()).toBe(n)
  })
})
