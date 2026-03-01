// ============================================================================
// ext-invoicing — Extension Zustand Store
// ============================================================================

import { create } from 'zustand'
import {
  ipc,
  type InvoiceWithItems,
  type DashboardStats,
  type InvoiceSettings
} from '../lib/ipc-client'

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'void' | 'all'

interface ExtInvoicingState {
  // Settings
  settings: InvoiceSettings | null
  loadingSettings: boolean

  // Data
  invoices: InvoiceWithItems[]
  selectedInvoice: InvoiceWithItems | null
  stats: DashboardStats | null

  // Filters
  statusFilter: InvoiceStatus

  // Loading states
  loading: boolean
  saving: boolean

  // Actions
  loadSettings: () => Promise<void>
  loadInvoices: (status?: InvoiceStatus) => Promise<void>
  loadStats: () => Promise<void>
  selectInvoice: (id: string | null) => Promise<void>
  createInvoice: (data: Parameters<typeof ipc.invoices.create>[0]) => Promise<string | null>
  updateInvoice: (id: string, data: Parameters<typeof ipc.invoices.update>[1]) => Promise<boolean>
  deleteInvoice: (id: string) => Promise<boolean>
  sendInvoice: (id: string) => Promise<boolean>
  markPaid: (id: string) => Promise<boolean>
  voidInvoice: (id: string, reason?: string) => Promise<boolean>
  createPaymentLink: (id: string) => Promise<string | null>
  setStatusFilter: (status: InvoiceStatus) => void
}

export const useExtInvoicingStore = create<ExtInvoicingState>()((set, get) => ({
  // Initial state
  settings: null,
  loadingSettings: false,
  invoices: [],
  selectedInvoice: null,
  stats: null,
  statusFilter: 'all',
  loading: false,
  saving: false,

  // Actions
  loadSettings: async () => {
    set({ loadingSettings: true })
    const result = await ipc.settings.get()
    if (result.success && result.data) {
      set({ settings: result.data, loadingSettings: false })
    } else {
      set({ loadingSettings: false })
    }
  },

  loadInvoices: async (status?: InvoiceStatus) => {
    set({ loading: true })
    const filterStatus = status ?? get().statusFilter
    const result = await ipc.invoices.list({
      status: filterStatus === 'all' ? undefined : filterStatus,
      limit: 100
    })
    if (result.success && result.data) {
      set({ invoices: result.data, loading: false })
    } else {
      set({ loading: false })
    }
  },

  loadStats: async () => {
    const result = await ipc.dashboard.stats()
    if (result.success && result.data) {
      set({ stats: result.data })
    }
  },

  selectInvoice: async (id) => {
    if (!id) {
      set({ selectedInvoice: null })
      return
    }
    const result = await ipc.invoices.get(id)
    if (result.success && result.data) {
      set({ selectedInvoice: result.data })
    }
  },

  createInvoice: async (data) => {
    set({ saving: true })
    const result = await ipc.invoices.create(data)
    set({ saving: false })
    if (result.success && result.data) {
      await get().loadInvoices()
      await get().loadStats()
      return result.data.id
    }
    return null
  },

  updateInvoice: async (id, data) => {
    set({ saving: true })
    const result = await ipc.invoices.update(id, data)
    set({ saving: false })
    if (result.success) {
      await get().loadInvoices()
      if (get().selectedInvoice?.id === id) {
        await get().selectInvoice(id)
      }
      return true
    }
    return false
  },

  deleteInvoice: async (id) => {
    const result = await ipc.invoices.delete(id)
    if (result.success) {
      await get().loadInvoices()
      await get().loadStats()
      if (get().selectedInvoice?.id === id) {
        set({ selectedInvoice: null })
      }
      return true
    }
    return false
  },

  sendInvoice: async (id) => {
    const result = await ipc.invoices.send(id, true)
    if (result.success) {
      await get().loadInvoices()
      await get().loadStats()
      if (get().selectedInvoice?.id === id) {
        await get().selectInvoice(id)
      }
      return true
    }
    return false
  },

  markPaid: async (id) => {
    const result = await ipc.invoices.markPaid(id)
    if (result.success) {
      await get().loadInvoices()
      await get().loadStats()
      if (get().selectedInvoice?.id === id) {
        await get().selectInvoice(id)
      }
      return true
    }
    return false
  },

  voidInvoice: async (id, reason) => {
    const result = await ipc.invoices.void(id, reason)
    if (result.success) {
      await get().loadInvoices()
      await get().loadStats()
      if (get().selectedInvoice?.id === id) {
        await get().selectInvoice(id)
      }
      return true
    }
    return false
  },

  createPaymentLink: async (id) => {
    const result = await ipc.invoices.createPaymentLink(id)
    if (result.success && result.data) {
      if (get().selectedInvoice?.id === id) {
        await get().selectInvoice(id)
      }
      return result.data.paymentLinkUrl
    }
    return null
  },

  setStatusFilter: (status) => {
    set({ statusFilter: status })
    get().loadInvoices(status)
  }
}))

export const useStore = useExtInvoicingStore
