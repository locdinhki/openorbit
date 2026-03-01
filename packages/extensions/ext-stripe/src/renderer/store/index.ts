// ============================================================================
// ext-stripe — Extension Zustand Store
// ============================================================================

import { create } from 'zustand'
import { ipc, type DashboardMetrics } from '../lib/ipc-client'
import type { StripeCustomerRow } from '../../main/db/customers-repo'
import type { StripePaymentRow } from '../../main/db/payments-repo'
import type { StripeSubscriptionRow } from '../../main/db/subscriptions-repo'

interface ExtStripeState {
  // Settings
  hasSecretKey: boolean
  isLiveMode: boolean | null
  loadingSettings: boolean

  // Data
  customers: StripeCustomerRow[]
  payments: StripePaymentRow[]
  subscriptions: StripeSubscriptionRow[]
  metrics: DashboardMetrics | null

  // Selection
  selectedCustomerId: string | null
  selectedPaymentId: string | null

  // Loading states
  syncing: boolean
  syncingPayments: boolean
  syncingSubscriptions: boolean
  loadingMetrics: boolean

  // Actions
  loadSettings: () => Promise<void>
  testConnection: () => Promise<boolean>
  loadCustomers: (query?: string) => Promise<void>
  loadPayments: (customerId?: string) => Promise<void>
  loadSubscriptions: (customerId?: string, status?: string) => Promise<void>
  loadMetrics: () => Promise<void>
  syncCustomers: () => Promise<void>
  syncPayments: () => Promise<void>
  syncSubscriptions: () => Promise<void>
  selectCustomer: (id: string | null) => void
  selectPayment: (id: string | null) => void
}

export const useExtStripeStore = create<ExtStripeState>()((set, get) => ({
  // Initial state
  hasSecretKey: false,
  isLiveMode: null,
  loadingSettings: false,
  customers: [],
  payments: [],
  subscriptions: [],
  metrics: null,
  selectedCustomerId: null,
  selectedPaymentId: null,
  syncing: false,
  syncingPayments: false,
  syncingSubscriptions: false,
  loadingMetrics: false,

  // Actions
  loadSettings: async () => {
    set({ loadingSettings: true })
    const result = await ipc.settings.get()
    if (result.success && result.data) {
      set({
        hasSecretKey: result.data.hasSecretKey,
        loadingSettings: false
      })
    } else {
      set({ loadingSettings: false })
    }
  },

  testConnection: async () => {
    const result = await ipc.settings.testConnection()
    if (result.success && result.data) {
      set({ isLiveMode: result.data.liveMode })
      return true
    }
    return false
  },

  loadCustomers: async (query?: string) => {
    const result = await ipc.customers.list({ query, limit: 100 })
    if (result.success && result.data) {
      set({ customers: result.data })
    }
  },

  loadPayments: async (customerId?: string) => {
    const result = await ipc.payments.list({ customerId, limit: 100 })
    if (result.success && result.data) {
      set({ payments: result.data })
    }
  },

  loadSubscriptions: async (customerId?: string, status?: string) => {
    const result = await ipc.subscriptions.list({
      customerId,
      status: status as 'active' | 'past_due' | 'canceled' | 'all',
      limit: 100
    })
    if (result.success && result.data) {
      set({ subscriptions: result.data })
    }
  },

  loadMetrics: async () => {
    set({ loadingMetrics: true })
    const result = await ipc.dashboard.metrics()
    if (result.success && result.data) {
      set({ metrics: result.data, loadingMetrics: false })
    } else {
      set({ loadingMetrics: false })
    }
  },

  syncCustomers: async () => {
    set({ syncing: true })
    await ipc.customers.sync()
    await get().loadCustomers()
    set({ syncing: false })
  },

  syncPayments: async () => {
    set({ syncingPayments: true })
    await ipc.payments.sync()
    await get().loadPayments()
    set({ syncingPayments: false })
  },

  syncSubscriptions: async () => {
    set({ syncingSubscriptions: true })
    await ipc.subscriptions.sync()
    await get().loadSubscriptions()
    set({ syncingSubscriptions: false })
  },

  selectCustomer: (id) => set({ selectedCustomerId: id }),
  selectPayment: (id) => set({ selectedPaymentId: id })
}))

export const useStore = useExtStripeStore
