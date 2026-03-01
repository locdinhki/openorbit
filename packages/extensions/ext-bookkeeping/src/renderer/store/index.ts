// ============================================================================
// ext-bookkeeping — Extension Zustand Store
// ============================================================================

import { create } from 'zustand'
import { ipc } from '../lib/ipc-client'
import type { BkAccountRow } from '../../main/db/accounts-repo'
import type { BkCategoryRow } from '../../main/db/categories-repo'
import type { BkTransactionRow } from '../../main/db/transactions-repo'
import type { ProfitLossReport } from '../../main/reports/profit-loss'

interface ExtBookkeepingState {
  // Data
  accounts: BkAccountRow[]
  categories: BkCategoryRow[]
  transactions: BkTransactionRow[]
  profitLossReport: ProfitLossReport | null

  // Selection
  selectedAccountId: string | null
  selectedTransactionId: string | null

  // Filters
  showUncategorized: boolean
  dateRange: { start: string; end: string } | null

  // Loading states
  loading: boolean
  importing: boolean
  categorizing: boolean

  // Actions
  loadAccounts: () => Promise<void>
  loadCategories: () => Promise<void>
  loadTransactions: (opts?: {
    accountId?: string
    uncategorized?: boolean
    startDate?: string
    endDate?: string
  }) => Promise<void>
  loadProfitLoss: (startDate: string, endDate: string) => Promise<void>

  createAccount: (data: { name: string; type: string; openingBalance?: number }) => Promise<boolean>
  createTransaction: (data: Parameters<typeof ipc.transactions.create>[0]) => Promise<boolean>
  updateTransaction: (
    id: string,
    data: Parameters<typeof ipc.transactions.update>[1]
  ) => Promise<boolean>
  deleteTransaction: (id: string) => Promise<boolean>

  importFromPlaid: () => Promise<{ imported: number; skipped: number } | null>
  importFromStripe: () => Promise<{ imported: number; skipped: number } | null>
  aiCategorizeUncategorized: () => Promise<{ processed: number; applied: number } | null>

  selectAccount: (id: string | null) => void
  selectTransaction: (id: string | null) => void
  setShowUncategorized: (show: boolean) => void
}

export const useExtBookkeepingStore = create<ExtBookkeepingState>()((set, get) => ({
  // Initial state
  accounts: [],
  categories: [],
  transactions: [],
  profitLossReport: null,
  selectedAccountId: null,
  selectedTransactionId: null,
  showUncategorized: false,
  dateRange: null,
  loading: false,
  importing: false,
  categorizing: false,

  // Actions
  loadAccounts: async () => {
    const result = await ipc.accounts.list()
    if (result.success && result.data) {
      set({ accounts: result.data })
    }
  },

  loadCategories: async () => {
    const result = await ipc.categories.list()
    if (result.success && result.data) {
      set({ categories: result.data })
    }
  },

  loadTransactions: async (opts) => {
    set({ loading: true })
    const result = await ipc.transactions.list({
      accountId: opts?.accountId ?? get().selectedAccountId ?? undefined,
      uncategorized: opts?.uncategorized ?? get().showUncategorized,
      startDate: opts?.startDate,
      endDate: opts?.endDate,
      limit: 200
    })
    if (result.success && result.data) {
      set({ transactions: result.data, loading: false })
    } else {
      set({ loading: false })
    }
  },

  loadProfitLoss: async (startDate, endDate) => {
    const result = await ipc.reports.profitLoss(startDate, endDate)
    if (result.success && result.data) {
      set({ profitLossReport: result.data })
    }
  },

  createAccount: async (data) => {
    const result = await ipc.accounts.create(data)
    if (result.success) {
      await get().loadAccounts()
      return true
    }
    return false
  },

  createTransaction: async (data) => {
    const result = await ipc.transactions.create(data)
    if (result.success) {
      await get().loadTransactions()
      await get().loadAccounts() // Refresh balances
      return true
    }
    return false
  },

  updateTransaction: async (id, data) => {
    const result = await ipc.transactions.update(id, data)
    if (result.success) {
      await get().loadTransactions()
      return true
    }
    return false
  },

  deleteTransaction: async (id) => {
    const result = await ipc.transactions.delete(id)
    if (result.success) {
      await get().loadTransactions()
      await get().loadAccounts()
      return true
    }
    return false
  },

  importFromPlaid: async () => {
    set({ importing: true })
    const result = await ipc.import.fromPlaid()
    set({ importing: false })
    if (result.success && result.data) {
      await get().loadTransactions()
      await get().loadAccounts()
      return result.data
    }
    return null
  },

  importFromStripe: async () => {
    set({ importing: true })
    const result = await ipc.import.fromStripe()
    set({ importing: false })
    if (result.success && result.data) {
      await get().loadTransactions()
      await get().loadAccounts()
      return result.data
    }
    return null
  },

  aiCategorizeUncategorized: async () => {
    set({ categorizing: true })
    const result = await ipc.ai.categorizeBatch({ uncategorizedOnly: true })
    set({ categorizing: false })
    if (result.success && result.data) {
      await get().loadTransactions()
      return result.data
    }
    return null
  },

  selectAccount: (id) => {
    set({ selectedAccountId: id })
    get().loadTransactions({ accountId: id ?? undefined })
  },

  selectTransaction: (id) => set({ selectedTransactionId: id }),

  setShowUncategorized: (show) => {
    set({ showUncategorized: show })
    get().loadTransactions({ uncategorized: show })
  }
}))

export const useStore = useExtBookkeepingStore
