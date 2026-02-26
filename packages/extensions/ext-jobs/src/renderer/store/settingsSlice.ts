import type { StateCreator } from 'zustand'

export interface SettingsSlice {
  apiKeys: string[]
  settingsLoading: boolean
  autonomyLevel: number
  autoApplyThreshold: number
  reviewThreshold: number
  skipThreshold: number
  dailyCap: number
  sessionCap: number
  actionsPerMinute: number

  setApiKeys: (keys: string[]) => void
  addApiKey: (key: string) => void
  removeApiKey: (index: number) => void
  setSettingsLoading: (loading: boolean) => void
  setAutonomyLevel: (level: number) => void
  setAutoApplyThreshold: (value: number) => void
  setReviewThreshold: (value: number) => void
  setSkipThreshold: (value: number) => void
  setDailyCap: (value: number) => void
  setSessionCap: (value: number) => void
  setActionsPerMinute: (value: number) => void
}

export const createSettingsSlice: StateCreator<SettingsSlice> = (set) => ({
  apiKeys: [],
  settingsLoading: false,
  autonomyLevel: 1,
  autoApplyThreshold: 85,
  reviewThreshold: 60,
  skipThreshold: 30,
  dailyCap: 50,
  sessionCap: 20,
  actionsPerMinute: 4,

  setApiKeys: (apiKeys) => set({ apiKeys }),
  addApiKey: (key) => set((state) => ({ apiKeys: [...state.apiKeys, key] })),
  removeApiKey: (index) =>
    set((state) => ({ apiKeys: state.apiKeys.filter((_, i) => i !== index) })),
  setSettingsLoading: (loading) => set({ settingsLoading: loading }),
  setAutonomyLevel: (level) => set({ autonomyLevel: level }),
  setAutoApplyThreshold: (value) => set({ autoApplyThreshold: value }),
  setReviewThreshold: (value) => set({ reviewThreshold: value }),
  setSkipThreshold: (value) => set({ skipThreshold: value }),
  setDailyCap: (value) => set({ dailyCap: value }),
  setSessionCap: (value) => set({ sessionCap: value }),
  setActionsPerMinute: (value) => set({ actionsPerMinute: value })
})
