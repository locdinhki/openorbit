/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockCheckForUpdates, mockQuitAndInstall, mockOn, mockSend } = vi.hoisted(() => ({
  mockCheckForUpdates: vi.fn().mockResolvedValue(null),
  mockQuitAndInstall: vi.fn(),
  mockOn: vi.fn(),
  mockSend: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: vi.fn()
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: mockOn,
    checkForUpdates: mockCheckForUpdates,
    quitAndInstall: mockQuitAndInstall,
    logger: null,
    autoDownload: false,
    autoInstallOnAppQuit: false
  }
}))

vi.mock('@openorbit/core/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

import { Updater } from '../updater'

function makeMockWindow(): any {
  return {
    webContents: { send: mockSend }
  }
}

describe('Updater', () => {
  let updater: Updater

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    updater = new Updater({ isAutomationRunning: () => false })
  })

  afterEach(() => {
    updater.destroy()
    vi.useRealTimers()
  })

  describe('init', () => {
    it('registers event handlers on autoUpdater', () => {
      updater.init(makeMockWindow())

      expect(mockOn).toHaveBeenCalledWith('update-available', expect.any(Function))
      expect(mockOn).toHaveBeenCalledWith('update-downloaded', expect.any(Function))
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('schedules initial check after startup delay', () => {
      updater.init(makeMockWindow())

      expect(mockCheckForUpdates).not.toHaveBeenCalled()
      vi.advanceTimersByTime(5000)
      expect(mockCheckForUpdates).toHaveBeenCalledOnce()
    })

    it('schedules periodic checks every 4 hours', () => {
      updater.init(makeMockWindow())

      // Initial delay
      vi.advanceTimersByTime(5000)
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(1)

      // After 4 hours
      vi.advanceTimersByTime(4 * 60 * 60 * 1000)
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(2)
    })
  })

  describe('checkForUpdates', () => {
    it('calls autoUpdater.checkForUpdates', () => {
      updater.init(makeMockWindow())
      updater.checkForUpdates()

      expect(mockCheckForUpdates).toHaveBeenCalled()
    })

    it('skips check when automation is running', () => {
      const u = new Updater({ isAutomationRunning: () => true })
      u.init(makeMockWindow())

      u.checkForUpdates()
      expect(mockCheckForUpdates).not.toHaveBeenCalled()
      u.destroy()
    })
  })

  describe('update-available event', () => {
    it('sends UPDATE_AVAILABLE IPC to renderer', () => {
      updater.init(makeMockWindow())

      const handler = mockOn.mock.calls.find((c: any[]) => c[0] === 'update-available')?.[1]
      handler({ version: '2.0.0', releaseNotes: 'Bug fixes' })

      expect(mockSend).toHaveBeenCalledWith('update:available', {
        version: '2.0.0',
        releaseNotes: 'Bug fixes'
      })
    })
  })

  describe('update-downloaded event', () => {
    it('sends UPDATE_READY IPC to renderer', () => {
      updater.init(makeMockWindow())

      const handler = mockOn.mock.calls.find((c: any[]) => c[0] === 'update-downloaded')?.[1]
      handler({ version: '2.0.0' })

      expect(mockSend).toHaveBeenCalledWith('update:ready', { version: '2.0.0' })
    })
  })

  describe('installUpdate', () => {
    it('calls quitAndInstall', () => {
      updater.init(makeMockWindow())
      updater.installUpdate()

      expect(mockQuitAndInstall).toHaveBeenCalledWith(false, true)
    })
  })

  describe('destroy', () => {
    it('clears the check interval', () => {
      updater.init(makeMockWindow())

      updater.destroy()

      // After destroy, periodic checks should not fire
      mockCheckForUpdates.mockClear()
      vi.advanceTimersByTime(4 * 60 * 60 * 1000)
      // Only the startup delay timer might fire, but no interval
      expect(mockCheckForUpdates).toHaveBeenCalledTimes(0)
    })
  })
})
