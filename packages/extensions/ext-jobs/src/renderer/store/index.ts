// ============================================================================
// ext-jobs — Extension Zustand Store
// ============================================================================

import { create } from 'zustand'
import { createJobsSlice, type JobsSlice } from './jobsSlice'
import { createProfilesSlice, type ProfilesSlice } from './profilesSlice'
import { createAutomationSlice, type AutomationSlice } from './automationSlice'
import { createChatSlice, type ChatSlice } from './chatSlice'
import { createMemorySlice, type MemorySlice } from './memorySlice'
import { createSettingsSlice, type SettingsSlice } from './settingsSlice'

export type ExtJobsStore = JobsSlice &
  ProfilesSlice &
  AutomationSlice &
  ChatSlice &
  MemorySlice &
  SettingsSlice

export const useExtJobsStore = create<ExtJobsStore>()((...a) => ({
  ...createJobsSlice(...a),
  ...createProfilesSlice(...a),
  ...createAutomationSlice(...a),
  ...createChatSlice(...a),
  ...createMemorySlice(...a),
  ...createSettingsSlice(...a)
}))

// Backward-compatible alias — existing components import { useStore }
export const useStore = useExtJobsStore
