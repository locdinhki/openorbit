import { ElectronAPI } from '@electron-toolkit/preload'

interface OpenOrbitAPI {
  send: (channel: string, ...args: unknown[]) => void
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: OpenOrbitAPI
  }
}
