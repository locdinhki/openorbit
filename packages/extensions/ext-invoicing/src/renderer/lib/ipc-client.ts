// ============================================================================
// ext-invoicing — Renderer IPC Client
// ============================================================================

import { EXT_INVOICING_IPC } from '../../ipc-channels'
import type { InvoiceRow } from '../../main/db/invoices-repo'
import type { InvoiceItemRow } from '../../main/db/invoice-items-repo'
import type { InvoicePaymentRow } from '../../main/db/payments-repo'
import type { InvoiceTemplateRow } from '../../main/db/templates-repo'
import type { InvoiceRecurringRow } from '../../main/db/recurring-repo'

interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

const api = window.api

function invoke<T = unknown>(channel: string, data: unknown): Promise<IPCResult<T>> {
  return api.invoke(channel, data) as Promise<IPCResult<T>>
}

export interface InvoiceSettings {
  companyName: string | null
  companyEmail: string | null
  companyAddress: string | null
  defaultTaxRate: number
  paymentTermsDays: number
}

export interface InvoiceWithItems extends InvoiceRow {
  items: InvoiceItemRow[]
  payments?: InvoicePaymentRow[]
}

export interface DashboardStats {
  totalInvoices: number
  draftCount: number
  sentCount: number
  paidCount: number
  overdueCount: number
  overdueAmount: number
  totalPaid: number
  totalOutstanding: number
  recurringCount: number
  upcomingRecurring: number
}

export interface InvoiceItemInput {
  description: string
  quantity: number
  unitPrice: number
}

export interface CustomerInput {
  name: string
  email: string
  address?: string
  phone?: string
}

export const ipc = {
  settings: {
    get: (): Promise<IPCResult<InvoiceSettings>> => invoke(EXT_INVOICING_IPC.SETTINGS_GET, {}),

    set: (data: Partial<InvoiceSettings>): Promise<IPCResult> =>
      invoke(EXT_INVOICING_IPC.SETTINGS_SET, data)
  },

  invoices: {
    list: (opts?: {
      status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'void' | 'all'
      customerId?: string
      limit?: number
      offset?: number
    }): Promise<IPCResult<InvoiceWithItems[]>> =>
      invoke(EXT_INVOICING_IPC.INVOICES_LIST, opts ?? {}),

    get: (id: string): Promise<IPCResult<InvoiceWithItems>> =>
      invoke(EXT_INVOICING_IPC.INVOICES_GET, { id }),

    create: (data: {
      customer: CustomerInput
      items: InvoiceItemInput[]
      taxRate?: number
      dueDate?: string
      notes?: string
      templateId?: string
    }): Promise<IPCResult<InvoiceWithItems>> => invoke(EXT_INVOICING_IPC.INVOICES_CREATE, data),

    update: (
      id: string,
      data: {
        customer?: CustomerInput
        items?: InvoiceItemInput[]
        taxRate?: number
        dueDate?: string
        notes?: string
      }
    ): Promise<IPCResult<InvoiceWithItems>> =>
      invoke(EXT_INVOICING_IPC.INVOICES_UPDATE, { id, ...data }),

    delete: (id: string): Promise<IPCResult> => invoke(EXT_INVOICING_IPC.INVOICES_DELETE, { id }),

    send: (id: string, includePaymentLink?: boolean): Promise<IPCResult> =>
      invoke(EXT_INVOICING_IPC.INVOICES_SEND, { id, includePaymentLink }),

    markPaid: (
      id: string,
      opts?: { paymentMethod?: string; paymentDate?: string; notes?: string }
    ): Promise<IPCResult> => invoke(EXT_INVOICING_IPC.INVOICES_MARK_PAID, { id, ...opts }),

    void: (id: string, reason?: string): Promise<IPCResult> =>
      invoke(EXT_INVOICING_IPC.INVOICES_VOID, { id, reason }),

    downloadPdf: (id: string): Promise<IPCResult<{ html: string; invoiceNumber: string }>> =>
      invoke(EXT_INVOICING_IPC.INVOICES_DOWNLOAD_PDF, { id }),

    createPaymentLink: (id: string): Promise<IPCResult<{ paymentLinkUrl: string }>> =>
      invoke(EXT_INVOICING_IPC.INVOICES_CREATE_PAYMENT_LINK, { id })
  },

  templates: {
    list: (): Promise<IPCResult<InvoiceTemplateRow[]>> =>
      invoke(EXT_INVOICING_IPC.TEMPLATES_LIST, {}),

    create: (data: {
      name: string
      logoUrl?: string
      primaryColor?: string
      headerText?: string
      footerText?: string
    }): Promise<IPCResult<InvoiceTemplateRow>> => invoke(EXT_INVOICING_IPC.TEMPLATES_CREATE, data),

    update: (
      id: string,
      data: Partial<{
        name: string
        logoUrl: string
        primaryColor: string
        headerText: string
        footerText: string
      }>
    ): Promise<IPCResult<InvoiceTemplateRow>> =>
      invoke(EXT_INVOICING_IPC.TEMPLATES_UPDATE, { id, ...data }),

    delete: (id: string): Promise<IPCResult> => invoke(EXT_INVOICING_IPC.TEMPLATES_DELETE, { id })
  },

  recurring: {
    list: (active?: boolean): Promise<IPCResult<InvoiceRecurringRow[]>> =>
      invoke(EXT_INVOICING_IPC.RECURRING_LIST, { active }),

    create: (data: {
      customer: CustomerInput
      items: InvoiceItemInput[]
      frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
      startDate: string
      autoSend?: boolean
    }): Promise<IPCResult<InvoiceRecurringRow>> => invoke(EXT_INVOICING_IPC.RECURRING_CREATE, data),

    update: (
      id: string,
      data: Partial<{
        items: InvoiceItemInput[]
        frequency: string
        nextDate: string
        autoSend: boolean
      }>
    ): Promise<IPCResult<InvoiceRecurringRow>> =>
      invoke(EXT_INVOICING_IPC.RECURRING_UPDATE, { id, ...data }),

    pause: (id: string, paused: boolean): Promise<IPCResult> =>
      invoke(EXT_INVOICING_IPC.RECURRING_PAUSE, { id, paused })
  },

  payments: {
    list: (opts?: {
      invoiceId?: string
      limit?: number
    }): Promise<IPCResult<InvoicePaymentRow[]>> =>
      invoke(EXT_INVOICING_IPC.PAYMENTS_LIST, opts ?? {}),

    record: (data: {
      invoiceId: string
      amount: number
      paymentMethod: 'cash' | 'check' | 'bank_transfer' | 'stripe' | 'other'
      paymentDate?: string
      notes?: string
    }): Promise<IPCResult<InvoicePaymentRow>> => invoke(EXT_INVOICING_IPC.PAYMENTS_RECORD, data)
  },

  dashboard: {
    stats: (opts?: { startDate?: string; endDate?: string }): Promise<IPCResult<DashboardStats>> =>
      invoke(EXT_INVOICING_IPC.DASHBOARD_STATS, opts ?? {})
  }
}

export type { IPCResult }
