import { Tray, Menu, app, nativeImage, BrowserWindow } from 'electron'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('TrayManager')

export type TrayState = 'idle' | 'running' | 'error'

export class TrayManager {
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null
  private state: TrayState = 'idle'
  private onStartAutomation?: () => void
  private onStopAutomation?: () => void

  constructor(opts?: { onStartAutomation?: () => void; onStopAutomation?: () => void }) {
    this.onStartAutomation = opts?.onStartAutomation
    this.onStopAutomation = opts?.onStopAutomation
  }

  init(mainWindow: BrowserWindow, iconPath: string): void {
    this.mainWindow = mainWindow

    let image = nativeImage.createFromPath(iconPath)

    // Resize for tray (macOS uses 16x16, Windows/Linux can use larger)
    if (!image.isEmpty()) {
      image = image.resize({ width: 16, height: 16 })
      if (process.platform === 'darwin') {
        image.setTemplateImage(true)
      }
    }

    this.tray = new Tray(image)
    this.tray.setToolTip('OpenOrbit')
    this.buildContextMenu()

    this.tray.on('click', () => {
      this.toggleWindow()
    })

    log.info('System tray initialized')
  }

  setState(state: TrayState): void {
    this.state = state
    this.buildContextMenu()

    const tooltips: Record<TrayState, string> = {
      idle: 'OpenOrbit — Idle',
      running: 'OpenOrbit — Running',
      error: 'OpenOrbit — Error'
    }
    this.tray?.setToolTip(tooltips[state])

    // On macOS, use title to show state indicator next to icon
    if (process.platform === 'darwin' && this.tray) {
      const titles: Record<TrayState, string> = {
        idle: '',
        running: '\u25CF',
        error: '!'
      }
      this.tray.setTitle(titles[state])
    }
  }

  getState(): TrayState {
    return this.state
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }

  private toggleWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return

    if (this.mainWindow.isVisible()) {
      this.mainWindow.hide()
    } else {
      this.mainWindow.show()
      this.mainWindow.focus()
    }
  }

  private buildContextMenu(): void {
    if (!this.tray) return

    const isRunning = this.state === 'running'

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'Show OpenOrbit',
        click: (): void => {
          this.mainWindow?.show()
          this.mainWindow?.focus()
        }
      },
      { type: 'separator' },
      {
        label: `Status: ${this.state.charAt(0).toUpperCase() + this.state.slice(1)}`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: isRunning ? 'Stop Automation' : 'Start Automation',
        click: (): void => {
          if (isRunning) {
            this.onStopAutomation?.()
          } else {
            this.onStartAutomation?.()
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: (): void => {
          app.quit()
        }
      }
    ]

    const menu = Menu.buildFromTemplate(template)
    this.tray.setContextMenu(menu)
  }
}
