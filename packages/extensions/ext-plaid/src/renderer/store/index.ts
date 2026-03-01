// ============================================================================
// ext-plaid — Extension Zustand Store
// ============================================================================

import { create } from 'zustand'
import { ipc } from '../lib/ipc-client'
import type { PlaidItemRow } from '../../main/db/items-repo'
import type { PlaidAccountRow } from '../../main/db/accounts-repo'
import type { PlaidTransactionRow } from '../../main/db/transactions-repo'

interface ExtPlaidState {
  // Settings
  hasCredentials: boolean
  environment: string
  loadingSettings: boolean

  // Data
  items: PlaidItemRow[]
  accounts: PlaidAccountRow[]
  transactions: PlaidTransactionRow[]

  // Selection
  selectedAccountId: string | null

  // Loading states
  syncing: boolean
  syncingTransactions: boolean

  // Actions
  loadSettings: () => Promise<void>
  loadItems: () => Promise<void>
  loadAccounts: (itemId?: string) => Promise<void>
  loadTransactions: (accountId?: string) => Promise<void>
  syncAccounts: (itemId?: string) => Promise<void>
  syncTransactions: (itemId?: string) => Promise<void>
  removeItem: (itemId: string) => Promise<boolean>
  selectAccount: (id: string | null) => void
}

export const useExtPlaidStore = create<ExtPlaidState>()((set, get) => ({
  // Initial state
  hasCredentials: false,
  environment: 'sandbox',
  loadingSettings: false,
  items: [],
  accounts: [],
  transactions: [],
  selectedAccountId: null,
  syncing: false,
  syncingTransactions: false,

  // Actions
  loadSettings: async () => {
    set({ loadingSettings: true })
    const result = await ipc.settings.get()
    if (result.success && result.data) {
      set({
        hasCredentials: result.data.hasCredentials,
        environment: result.data.environment,
        loadingSettings: false
      })
    } else {
      set({ loadingSettings: false })
    }
  },

  loadItems: async () => {
    const result = await ipc.items.list()
    if (result.success && result.data) {
      set({ items: result.data })
    }
  },

  loadAccounts: async (itemId?: string) => {
    const result = await ipc.accounts.list(itemId)
    if (result.success && result.data) {
      set({ accounts: result.data })
    }
  },

  loadTransactions: async (accountId?: string) => {
    const result = await ipc.transactions.list({ accountId, limit: 100 })
    if (result.success && result.data) {
      set({ transactions: result.data })
    }
  },

  syncAccounts: async (itemId?: string) => {
    set({ syncing: true })
    await ipc.accounts.sync(itemId)
    await get().loadAccounts()
    set({ syncing: false })
  },

  syncTransactions: async (itemId?: string) => {
    set({ syncingTransactions: true })
    await ipc.transactions.sync(itemId)
    await get().loadTransactions()
    set({ syncingTransactions: false })
  },

  removeItem: async (itemId: string) => {
    const result = await ipc.items.remove(itemId)
    if (result.success) {
      await get().loadItems()
      await get().loadAccounts()
      return true
    }
    return false
  },

  selectAccount: (id) => set({ selectedAccountId: id })
}))

export const useStore = useExtPlaidStore
