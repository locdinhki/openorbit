import type { StateCreator } from 'zustand'
import type { AutomationStatus } from '../lib/types'

export interface AutomationSlice {
  automationStatus: AutomationStatus | null
  setAutomationStatus: (status: AutomationStatus) => void
}

export const createAutomationSlice: StateCreator<AutomationSlice> = (set) => ({
  automationStatus: null,
  setAutomationStatus: (status) => set({ automationStatus: status })
})
