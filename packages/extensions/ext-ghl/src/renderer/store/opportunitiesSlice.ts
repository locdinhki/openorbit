import type { StateCreator } from 'zustand'
import type { GhlOpportunityRow } from '../../main/db/opportunities-repo'
import type { GhlPipelineRow } from '../../main/db/pipelines-repo'
import { ipc } from '../lib/ipc-client'

export interface OpportunitiesSlice {
  pipelines: GhlPipelineRow[]
  selectedPipelineId: string | null
  opportunities: GhlOpportunityRow[]
  oppsLoading: boolean
  selectedOpportunity: GhlOpportunityRow | null
  loadPipelines: () => Promise<void>
  loadOpportunities: (pipelineId?: string) => Promise<void>
  syncOpportunities: () => Promise<void>
  selectPipeline: (id: string) => void
  selectOpportunity: (opp: GhlOpportunityRow | null) => void
  oppsSyncing: boolean
}

export const createOpportunitiesSlice: StateCreator<OpportunitiesSlice> = (set, get) => ({
  pipelines: [],
  selectedPipelineId: null,
  opportunities: [],
  oppsLoading: false,
  selectedOpportunity: null,
  oppsSyncing: false,

  loadPipelines: async () => {
    const res = await ipc.pipelines.list()
    if (res.success && res.data) {
      set({ pipelines: res.data })
      if (res.data.length > 0 && !get().selectedPipelineId) {
        set({ selectedPipelineId: res.data[0].id })
        get().loadOpportunities(res.data[0].id)
      }
    }
  },

  loadOpportunities: async (pipelineId) => {
    const pid = pipelineId ?? get().selectedPipelineId ?? undefined
    set({ oppsLoading: true })
    const res = await ipc.opportunities.list({ pipelineId: pid })
    if (res.success && res.data) {
      set({ opportunities: res.data, oppsLoading: false })
    } else {
      set({ oppsLoading: false })
    }
  },

  syncOpportunities: async () => {
    set({ oppsSyncing: true })
    const res = await ipc.opportunities.sync()
    set({ oppsSyncing: false })
    if (res.success) {
      await get().loadPipelines()
      await get().loadOpportunities()
    }
  },

  selectPipeline: (id) => {
    set({ selectedPipelineId: id, selectedOpportunity: null })
    get().loadOpportunities(id)
  },

  selectOpportunity: (opp) => set({ selectedOpportunity: opp })
})
