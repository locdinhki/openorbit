import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '@openorbit/core/ipc-channels'

const shellChannels = new Set<string>(Object.values(IPC))

/** Extension channels use the `ext-` prefix (e.g. `ext-jobs:list`). */
function isValidChannel(channel: string): boolean {
  return shellChannels.has(channel) || channel.startsWith('ext-')
}

const api = {
  send: (channel: string, ...args: unknown[]): void => {
    if (isValidChannel(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (isValidChannel(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`Invalid IPC channel: ${channel}`))
  },
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (isValidChannel(channel)) {
      const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void =>
        callback(...args)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
    return () => {}
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
