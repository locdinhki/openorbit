import { create } from 'zustand'
import { createConnectionSlice, type ConnectionSlice } from './connectionSlice'
import { createChatSlice, type ChatSlice } from './chatSlice'
import { createJobsSlice, type JobsSlice } from './jobsSlice'
import { createAutomationSlice, type AutomationSlice } from './automationSlice'

export type WebUIStore = ConnectionSlice & ChatSlice & JobsSlice & AutomationSlice

export const useStore = create<WebUIStore>()((...a) => ({
  ...createConnectionSlice(...a),
  ...createChatSlice(...a),
  ...createJobsSlice(...a),
  ...createAutomationSlice(...a)
}))
