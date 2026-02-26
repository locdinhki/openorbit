import type { StateCreator } from 'zustand'
import type { AutomationState, PlatformStatus } from '@openorbit/core/types'

export interface AutomationSlice {
  automationState: AutomationState
  sessionInitialized: boolean
  currentAction: string | null
  jobsExtracted: number
  jobsAnalyzed: number
  applicationsSubmitted: number
  actionsPerMinute: number
  sessionStartTime: string | null
  errors: string[]
  platforms: PlatformStatus[]
  setAutomationState: (state: AutomationState) => void
  setSessionInitialized: (initialized: boolean) => void
  setCurrentAction: (action: string | null) => void
  updateStats: (stats: {
    jobsExtracted?: number
    jobsAnalyzed?: number
    applicationsSubmitted?: number
    actionsPerMinute?: number
  }) => void
  setPlatforms: (platforms: PlatformStatus[]) => void
  addError: (error: string) => void
  clearErrors: () => void
  startSession: () => void
}

export const createAutomationSlice: StateCreator<AutomationSlice> = (set) => ({
  automationState: 'idle',
  sessionInitialized: false,
  currentAction: null,
  jobsExtracted: 0,
  jobsAnalyzed: 0,
  applicationsSubmitted: 0,
  actionsPerMinute: 0,
  sessionStartTime: null,
  errors: [],
  platforms: [],
  setAutomationState: (automationState) => set({ automationState }),
  setSessionInitialized: (initialized) => set({ sessionInitialized: initialized }),
  setCurrentAction: (action) => set({ currentAction: action }),
  updateStats: (stats) =>
    set((state) => ({
      jobsExtracted: stats.jobsExtracted ?? state.jobsExtracted,
      jobsAnalyzed: stats.jobsAnalyzed ?? state.jobsAnalyzed,
      applicationsSubmitted: stats.applicationsSubmitted ?? state.applicationsSubmitted,
      actionsPerMinute: stats.actionsPerMinute ?? state.actionsPerMinute
    })),
  setPlatforms: (platforms) => set({ platforms }),
  addError: (error) => set((state) => ({ errors: [...state.errors, error] })),
  clearErrors: () => set({ errors: [] }),
  startSession: () =>
    set({
      sessionStartTime: new Date().toISOString(),
      jobsExtracted: 0,
      jobsAnalyzed: 0,
      applicationsSubmitted: 0
    })
})
