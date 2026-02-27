import type { StateCreator } from 'zustand'
import { RPCClient } from '../lib/rpc-client'

export interface ConnectionSlice {
  rpcClient: RPCClient | null
  connected: boolean
  connecting: boolean
  connectionError: string | null
  connect: (wsUrl: string, token: string) => Promise<void>
  disconnect: () => void
}

export const createConnectionSlice: StateCreator<ConnectionSlice> = (set, get) => ({
  rpcClient: null,
  connected: false,
  connecting: false,
  connectionError: null,

  connect: async (wsUrl, token) => {
    set({ connecting: true, connectionError: null })
    const client = new RPCClient(wsUrl, token)
    try {
      await client.connect()
      set({ rpcClient: client, connected: true, connecting: false })
      // Persist credentials for auto-reconnect
      localStorage.setItem('oo-ws-url', wsUrl)
      localStorage.setItem('oo-token', token)
    } catch (err) {
      set({ connecting: false, connectionError: err instanceof Error ? err.message : String(err) })
      throw err
    }
  },

  disconnect: () => {
    get().rpcClient?.close()
    set({ rpcClient: null, connected: false })
    localStorage.removeItem('oo-ws-url')
    localStorage.removeItem('oo-token')
  }
})
