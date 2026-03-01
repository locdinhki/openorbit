// ============================================================================
// ext-deal-analyzer — Extension Zustand Store
// ============================================================================

import { create } from 'zustand'
import {
  ipc,
  type DealRow,
  type DealCompRow,
  type DealExpenseRow,
  type DealMetrics,
  type DealComparison
} from '../lib/ipc-client'

// ---------------------------------------------------------------------------
// Store Types
// ---------------------------------------------------------------------------

interface DealsSlice {
  deals: DealRow[]
  dealsLoading: boolean
  dealsError: string | null
  selectedDealId: string | null
  loadDeals: (status?: 'active' | 'archived' | 'all') => Promise<void>
  selectDeal: (id: string | null) => void
  createDeal: (input: Parameters<typeof ipc.deals.create>[0]) => Promise<DealRow | null>
  updateDeal: (input: Parameters<typeof ipc.deals.update>[0]) => Promise<DealRow | null>
  deleteDeal: (id: string) => Promise<boolean>
}

interface AnalysisSlice {
  analysis: { metrics: DealMetrics; compsAveragePrice: number | null } | null
  analysisLoading: boolean
  analysisError: string | null
  analyze: (dealId: string) => Promise<void>
  clearAnalysis: () => void
}

interface CompsSlice {
  comps: DealCompRow[]
  compsLoading: boolean
  loadComps: (dealId: string) => Promise<void>
  addComp: (input: Parameters<typeof ipc.comps.add>[0]) => Promise<DealCompRow | null>
  deleteComp: (id: string) => Promise<boolean>
}

interface ExpensesSlice {
  expenses: DealExpenseRow[]
  expensesLoading: boolean
  loadExpenses: (dealId: string) => Promise<void>
  addExpense: (input: Parameters<typeof ipc.expenses.add>[0]) => Promise<DealExpenseRow | null>
  deleteExpense: (id: string) => Promise<boolean>
}

interface CompareSlice {
  comparison: DealComparison | null
  compareLoading: boolean
  compareError: string | null
  compareDeals: (dealIds: string[]) => Promise<void>
  clearComparison: () => void
}

interface ExportSlice {
  exporting: boolean
  exportError: string | null
  lastExportPath: string | null
  exportPdf: (
    dealId: string,
    options?: Parameters<typeof ipc.analysis.exportPdf>[1]
  ) => Promise<string | null>
}

interface UISlice {
  view: 'list' | 'detail' | 'compare' | 'form'
  setView: (view: 'list' | 'detail' | 'compare' | 'form') => void
  formMode: 'create' | 'edit'
  setFormMode: (mode: 'create' | 'edit') => void
  compareIds: string[]
  toggleCompareId: (id: string) => void
  clearCompareIds: () => void
}

type DealAnalyzerStore = DealsSlice &
  AnalysisSlice &
  CompsSlice &
  ExpensesSlice &
  CompareSlice &
  ExportSlice &
  UISlice

// ---------------------------------------------------------------------------
// Store Implementation
// ---------------------------------------------------------------------------

export const useDealAnalyzerStore = create<DealAnalyzerStore>()((set, get) => ({
  // ---- Deals Slice ----
  deals: [],
  dealsLoading: false,
  dealsError: null,
  selectedDealId: null,

  loadDeals: async (status = 'active') => {
    set({ dealsLoading: true, dealsError: null })
    const res = await ipc.deals.list(100, 0, status)
    if (res.success && res.data) {
      set({ deals: res.data, dealsLoading: false })
    } else {
      set({ dealsLoading: false, dealsError: res.error ?? 'Failed to load deals' })
    }
  },

  selectDeal: (id) => {
    set({ selectedDealId: id, analysis: null, comps: [], expenses: [] })
    if (id) {
      get().analyze(id)
      get().loadComps(id)
      get().loadExpenses(id)
    }
  },

  createDeal: async (input) => {
    const res = await ipc.deals.create(input)
    if (res.success && res.data) {
      set((s) => ({ deals: [res.data!, ...s.deals] }))
      return res.data
    }
    return null
  },

  updateDeal: async (input) => {
    const res = await ipc.deals.update(input)
    if (res.success && res.data) {
      set((s) => ({
        deals: s.deals.map((d) => (d.id === res.data!.id ? res.data! : d))
      }))
      return res.data
    }
    return null
  },

  deleteDeal: async (id) => {
    const res = await ipc.deals.delete(id)
    if (res.success) {
      set((s) => ({
        deals: s.deals.filter((d) => d.id !== id),
        selectedDealId: s.selectedDealId === id ? null : s.selectedDealId
      }))
      return true
    }
    return false
  },

  // ---- Analysis Slice ----
  analysis: null,
  analysisLoading: false,
  analysisError: null,

  analyze: async (dealId) => {
    set({ analysisLoading: true, analysisError: null })
    const res = await ipc.analysis.analyze(dealId)
    if (res.success && res.data) {
      set({
        analysis: {
          metrics: res.data.metrics,
          compsAveragePrice: res.data.compsAveragePrice
        },
        comps: res.data.comps,
        expenses: res.data.expenses,
        analysisLoading: false
      })
    } else {
      set({ analysisLoading: false, analysisError: res.error ?? 'Analysis failed' })
    }
  },

  clearAnalysis: () => set({ analysis: null }),

  // ---- Comps Slice ----
  comps: [],
  compsLoading: false,

  loadComps: async (dealId) => {
    set({ compsLoading: true })
    const res = await ipc.comps.list(dealId)
    if (res.success && res.data) {
      set({ comps: res.data, compsLoading: false })
    } else {
      set({ compsLoading: false })
    }
  },

  addComp: async (input) => {
    const res = await ipc.comps.add(input)
    if (res.success && res.data) {
      set((s) => ({ comps: [res.data!, ...s.comps] }))
      return res.data
    }
    return null
  },

  deleteComp: async (id) => {
    const res = await ipc.comps.delete(id)
    if (res.success) {
      set((s) => ({ comps: s.comps.filter((c) => c.id !== id) }))
      return true
    }
    return false
  },

  // ---- Expenses Slice ----
  expenses: [],
  expensesLoading: false,

  loadExpenses: async (dealId) => {
    set({ expensesLoading: true })
    const res = await ipc.expenses.list(dealId)
    if (res.success && res.data) {
      set({ expenses: res.data, expensesLoading: false })
    } else {
      set({ expensesLoading: false })
    }
  },

  addExpense: async (input) => {
    const res = await ipc.expenses.add(input)
    if (res.success && res.data) {
      set((s) => ({ expenses: [res.data!, ...s.expenses] }))
      // Re-analyze to update metrics
      const dealId = get().selectedDealId
      if (dealId) {
        get().analyze(dealId)
      }
      return res.data
    }
    return null
  },

  deleteExpense: async (id) => {
    const res = await ipc.expenses.delete(id)
    if (res.success) {
      set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }))
      // Re-analyze to update metrics
      const dealId = get().selectedDealId
      if (dealId) {
        get().analyze(dealId)
      }
      return true
    }
    return false
  },

  // ---- Compare Slice ----
  comparison: null,
  compareLoading: false,
  compareError: null,

  compareDeals: async (dealIds) => {
    set({ compareLoading: true, compareError: null })
    const res = await ipc.analysis.compare(dealIds)
    if (res.success && res.data) {
      set({ comparison: res.data, compareLoading: false })
    } else {
      set({ compareLoading: false, compareError: res.error ?? 'Comparison failed' })
    }
  },

  clearComparison: () => set({ comparison: null }),

  // ---- Export Slice ----
  exporting: false,
  exportError: null,
  lastExportPath: null,

  exportPdf: async (dealId, options) => {
    set({ exporting: true, exportError: null })
    const res = await ipc.analysis.exportPdf(dealId, options)
    if (res.success && res.data) {
      set({ exporting: false, lastExportPath: res.data.filePath })
      return res.data.filePath
    } else {
      set({ exporting: false, exportError: res.error ?? 'Export failed' })
      return null
    }
  },

  // ---- UI Slice ----
  view: 'list',
  setView: (view) => set({ view }),
  formMode: 'create',
  setFormMode: (mode) => set({ formMode: mode }),
  compareIds: [],
  toggleCompareId: (id) =>
    set((s) => ({
      compareIds: s.compareIds.includes(id)
        ? s.compareIds.filter((i) => i !== id)
        : s.compareIds.length < 4
          ? [...s.compareIds, id]
          : s.compareIds
    })),
  clearCompareIds: () => set({ compareIds: [] })
}))

export const useStore = useDealAnalyzerStore
