/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockSetToolTip,
  mockSetContextMenu,
  mockTrayOn,
  mockTrayDestroy,
  mockBuildFromTemplate,
  mockAppQuit,
  mockCreateFromPath,
  MockTray
} = vi.hoisted(() => {
  const mockSetToolTip = vi.fn()
  const mockSetContextMenu = vi.fn()
  const mockSetTitle = vi.fn()
  const mockTrayOn = vi.fn()
  const mockTrayDestroy = vi.fn()
  const mockBuildFromTemplate = vi.fn().mockReturnValue({})
  const mockAppQuit = vi.fn()
  const mockSetTemplateImage = vi.fn()
  const mockCreateFromPath = vi.fn().mockReturnValue({
    isEmpty: vi.fn().mockReturnValue(false),
    resize: vi.fn().mockReturnValue({
      setTemplateImage: mockSetTemplateImage
    })
  })
  const MockTray = vi.fn().mockImplementation(function (this: any) {
    this.setToolTip = mockSetToolTip
    this.setContextMenu = mockSetContextMenu
    this.setTitle = mockSetTitle
    this.on = mockTrayOn
    this.destroy = mockTrayDestroy
  })

  return {
    mockSetToolTip,
    mockSetContextMenu,
    mockTrayOn,
    mockTrayDestroy,
    mockBuildFromTemplate,
    mockAppQuit,
    mockCreateFromPath,
    MockTray
  }
})

vi.mock('electron', () => ({
  Tray: MockTray,
  Menu: { buildFromTemplate: mockBuildFromTemplate },
  app: { quit: mockAppQuit },
  nativeImage: { createFromPath: mockCreateFromPath }
}))

vi.mock('@openorbit/core/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

import { TrayManager } from '../tray'

function makeMockWindow(): any {
  return {
    isDestroyed: vi.fn().mockReturnValue(false),
    isVisible: vi.fn().mockReturnValue(true),
    show: vi.fn(),
    hide: vi.fn(),
    focus: vi.fn()
  }
}

describe('TrayManager', () => {
  let tray: TrayManager
  let mockWindow: any

  beforeEach(() => {
    vi.clearAllMocks()
    tray = new TrayManager()
    mockWindow = makeMockWindow()
  })

  describe('init', () => {
    it('creates a tray with the provided icon', () => {
      tray.init(mockWindow, '/path/to/icon.png')

      expect(mockCreateFromPath).toHaveBeenCalledWith('/path/to/icon.png')
      expect(MockTray).toHaveBeenCalled()
      expect(mockSetToolTip).toHaveBeenCalledWith('OpenOrbit')
    })

    it('builds a context menu', () => {
      tray.init(mockWindow, '/path/to/icon.png')

      expect(mockBuildFromTemplate).toHaveBeenCalled()
      expect(mockSetContextMenu).toHaveBeenCalled()
    })

    it('registers click handler', () => {
      tray.init(mockWindow, '/path/to/icon.png')

      expect(mockTrayOn).toHaveBeenCalledWith('click', expect.any(Function))
    })
  })

  describe('setState', () => {
    beforeEach(() => {
      tray.init(mockWindow, '/path/to/icon.png')
      vi.clearAllMocks()
    })

    it('updates state and tooltip for idle', () => {
      tray.setState('idle')

      expect(tray.getState()).toBe('idle')
      expect(mockSetToolTip).toHaveBeenCalledWith('OpenOrbit \u2014 Idle')
    })

    it('updates state and tooltip for running', () => {
      tray.setState('running')

      expect(tray.getState()).toBe('running')
      expect(mockSetToolTip).toHaveBeenCalledWith('OpenOrbit \u2014 Running')
    })

    it('updates state and tooltip for error', () => {
      tray.setState('error')

      expect(tray.getState()).toBe('error')
      expect(mockSetToolTip).toHaveBeenCalledWith('OpenOrbit \u2014 Error')
    })

    it('rebuilds context menu on state change', () => {
      tray.setState('running')

      expect(mockBuildFromTemplate).toHaveBeenCalled()
      expect(mockSetContextMenu).toHaveBeenCalled()
    })
  })

  describe('context menu actions', () => {
    it('Show OpenOrbit shows and focuses window', () => {
      tray.init(mockWindow, '/path/to/icon.png')

      const template = mockBuildFromTemplate.mock.calls[0][0]
      const showItem = template.find((item: any) => item.label === 'Show OpenOrbit')
      showItem.click()

      expect(mockWindow.show).toHaveBeenCalled()
      expect(mockWindow.focus).toHaveBeenCalled()
    })

    it('Quit calls app.quit', () => {
      tray.init(mockWindow, '/path/to/icon.png')

      const template = mockBuildFromTemplate.mock.calls[0][0]
      const quitItem = template.find((item: any) => item.label === 'Quit')
      quitItem.click()

      expect(mockAppQuit).toHaveBeenCalled()
    })

    it('Start Automation calls onStartAutomation callback', () => {
      const onStart = vi.fn()
      const t = new TrayManager({ onStartAutomation: onStart })
      t.init(mockWindow, '/path/to/icon.png')

      const template = mockBuildFromTemplate.mock.calls[0][0]
      const startItem = template.find((item: any) => item.label === 'Start Automation')
      startItem.click()

      expect(onStart).toHaveBeenCalled()
    })

    it('Stop Automation shown when state is running', () => {
      const onStop = vi.fn()
      const t = new TrayManager({ onStopAutomation: onStop })
      t.init(mockWindow, '/path/to/icon.png')

      t.setState('running')

      const lastCall = mockBuildFromTemplate.mock.calls[mockBuildFromTemplate.mock.calls.length - 1]
      const template = lastCall[0]
      const stopItem = template.find((item: any) => item.label === 'Stop Automation')
      stopItem.click()

      expect(onStop).toHaveBeenCalled()
    })
  })

  describe('toggleWindow via click', () => {
    it('hides visible window on click', () => {
      mockWindow.isVisible.mockReturnValue(true)
      tray.init(mockWindow, '/path/to/icon.png')

      const clickHandler = mockTrayOn.mock.calls.find((c: any[]) => c[0] === 'click')?.[1]
      clickHandler()

      expect(mockWindow.hide).toHaveBeenCalled()
    })

    it('shows hidden window on click', () => {
      mockWindow.isVisible.mockReturnValue(false)
      tray.init(mockWindow, '/path/to/icon.png')

      const clickHandler = mockTrayOn.mock.calls.find((c: any[]) => c[0] === 'click')?.[1]
      clickHandler()

      expect(mockWindow.show).toHaveBeenCalled()
      expect(mockWindow.focus).toHaveBeenCalled()
    })
  })

  describe('destroy', () => {
    it('destroys the tray', () => {
      tray.init(mockWindow, '/path/to/icon.png')
      tray.destroy()

      expect(mockTrayDestroy).toHaveBeenCalled()
    })

    it('handles double destroy gracefully', () => {
      tray.init(mockWindow, '/path/to/icon.png')
      tray.destroy()
      tray.destroy()

      expect(mockTrayDestroy).toHaveBeenCalledOnce()
    })
  })

  describe('getState', () => {
    it('returns idle by default', () => {
      expect(tray.getState()).toBe('idle')
    })
  })
})
