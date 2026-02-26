import type { StateCreator } from 'zustand'
import { ipc } from '../lib/ipc-client'

export interface SettingsSlice {
  hasToken: boolean
  maskedToken: string | null
  locationId: string | null
  settingsLoading: boolean
  connectionTesting: boolean
  connectionResult: { connected: boolean; contactCount: number } | null
  loadSettings: () => Promise<void>
  saveSettings: (data: { token?: string; locationId?: string }) => Promise<void>
  testConnection: () => Promise<void>
}

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  hasToken: false,
  maskedToken: null,
  locationId: null,
  settingsLoading: false,
  connectionTesting: false,
  connectionResult: null,

  loadSettings: async () => {
    set({ settingsLoading: true })
    const res = await ipc.settings.get()
    if (res.success && res.data) {
      set({
        hasToken: res.data.hasToken,
        maskedToken: res.data.token,
        locationId: res.data.locationId,
        settingsLoading: false
      })
    } else {
      set({ settingsLoading: false })
    }
  },

  saveSettings: async (data) => {
    await ipc.settings.set(data)
    const res = await ipc.settings.get()
    if (res.success && res.data) {
      set({
        hasToken: res.data.hasToken,
        maskedToken: res.data.token,
        locationId: res.data.locationId
      })
    }
  },

  testConnection: async () => {
    set({ connectionTesting: true, connectionResult: null })
    const res = await ipc.settings.testConnection()
    if (res.success && res.data) {
      set({ connectionTesting: false, connectionResult: res.data })
    } else {
      set({ connectionTesting: false, connectionResult: null })
    }
  }
})
