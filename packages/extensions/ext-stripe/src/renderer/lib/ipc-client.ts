// ============================================================================
// ext-stripe — Renderer IPC Client
// ============================================================================

import { EXT_STRIPE_IPC } from '../../ipc-channels'
import type { StripeCustomerRow } from '../../main/db/customers-repo'
import type { StripePaymentRow } from '../../main/db/payments-repo'
import type { StripeSubscriptionRow } from '../../main/db/subscriptions-repo'
import type { StripePaymentLinkRow } from '../../main/db/payment-links-repo'

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

export interface StripeSettings {
  hasSecretKey: boolean
  secretKeyPreview: string | null
  hasWebhookSecret: boolean
}

export interface ConnectionTestResult {
  connected: boolean
  liveMode: boolean
  availableBalance: number
  currency: string
}

export interface DashboardMetrics {
  totalCustomers: number
  totalPayments: number
  totalRevenue: number
  periodRevenue: number
  periodPaymentCount: number
  activeSubscriptions: number
  totalSubscriptions: number
  mrr: number
  startDate: string
  endDate: string
}

export const ipc = {
  settings: {
    get: (): Promise<IPCResult<StripeSettings>> => invoke(EXT_STRIPE_IPC.SETTINGS_GET, {}),

    set: (data: { secretKey?: string; webhookSecret?: string }): Promise<IPCResult> =>
      invoke(EXT_STRIPE_IPC.SETTINGS_SET, data),

    testConnection: (): Promise<IPCResult<ConnectionTestResult>> =>
      invoke(EXT_STRIPE_IPC.CONNECTION_TEST, {})
  },

  customers: {
    list: (opts?: {
      query?: string
      limit?: number
      offset?: number
    }): Promise<IPCResult<StripeCustomerRow[]>> =>
      invoke(EXT_STRIPE_IPC.CUSTOMERS_LIST, opts ?? {}),

    get: (id: string): Promise<IPCResult<StripeCustomerRow>> =>
      invoke(EXT_STRIPE_IPC.CUSTOMERS_GET, { id }),

    create: (data: {
      email: string
      name?: string
      phone?: string
      metadata?: Record<string, string>
    }): Promise<IPCResult> => invoke(EXT_STRIPE_IPC.CUSTOMERS_CREATE, data),

    sync: (): Promise<IPCResult<{ synced: number }>> => invoke(EXT_STRIPE_IPC.CUSTOMERS_SYNC, {})
  },

  payments: {
    list: (opts?: {
      customerId?: string
      limit?: number
    }): Promise<IPCResult<StripePaymentRow[]>> => invoke(EXT_STRIPE_IPC.PAYMENTS_LIST, opts ?? {}),

    sync: (): Promise<IPCResult<{ synced: number }>> => invoke(EXT_STRIPE_IPC.PAYMENTS_SYNC, {}),

    refund: (paymentIntentId: string, amount?: number): Promise<IPCResult> =>
      invoke(EXT_STRIPE_IPC.PAYMENTS_REFUND, { paymentIntentId, amount })
  },

  paymentLinks: {
    create: (data: {
      amount: number
      currency?: string
      description?: string
      metadata?: Record<string, string>
    }): Promise<IPCResult<{ id: string; url: string }>> =>
      invoke(EXT_STRIPE_IPC.PAYMENT_LINKS_CREATE, data),

    list: (opts?: {
      active?: boolean
      limit?: number
    }): Promise<IPCResult<StripePaymentLinkRow[]>> =>
      invoke(EXT_STRIPE_IPC.PAYMENT_LINKS_LIST, opts ?? {})
  },

  subscriptions: {
    list: (opts?: {
      customerId?: string
      status?: 'active' | 'past_due' | 'canceled' | 'all'
      limit?: number
    }): Promise<IPCResult<StripeSubscriptionRow[]>> => invoke(EXT_STRIPE_IPC.SUBS_LIST, opts ?? {}),

    sync: (): Promise<IPCResult<{ synced: number }>> => invoke(EXT_STRIPE_IPC.SUBS_SYNC, {}),

    cancel: (subscriptionId: string, cancelAtPeriodEnd?: boolean): Promise<IPCResult> =>
      invoke(EXT_STRIPE_IPC.SUBS_CANCEL, { subscriptionId, cancelAtPeriodEnd })
  },

  dashboard: {
    metrics: (opts?: {
      startDate?: string
      endDate?: string
    }): Promise<IPCResult<DashboardMetrics>> => invoke(EXT_STRIPE_IPC.DASHBOARD_METRICS, opts ?? {})
  }
}

export type { IPCResult }
