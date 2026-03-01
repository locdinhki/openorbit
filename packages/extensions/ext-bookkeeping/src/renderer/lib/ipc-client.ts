// ============================================================================
// ext-bookkeeping — Renderer IPC Client
// ============================================================================

import { EXT_BOOKKEEPING_IPC } from '../../ipc-channels'
import type { BkAccountRow } from '../../main/db/accounts-repo'
import type { BkCategoryRow } from '../../main/db/categories-repo'
import type { BkTransactionRow } from '../../main/db/transactions-repo'
import type { ProfitLossReport } from '../../main/reports/profit-loss'
import type { CashFlowReport } from '../../main/reports/cash-flow'
import type { TaxReport } from '../../main/reports/tax-report'

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

export interface BookkeepingSettings {
  fiscalYearStart: number
  defaultCurrency: string
}

export interface CategorizationResult {
  categoryId: string
  confidence: number
  reasoning: string
}

export const ipc = {
  settings: {
    get: (): Promise<IPCResult<BookkeepingSettings>> =>
      invoke(EXT_BOOKKEEPING_IPC.SETTINGS_GET, {}),

    set: (data: Partial<BookkeepingSettings>): Promise<IPCResult> =>
      invoke(EXT_BOOKKEEPING_IPC.SETTINGS_SET, data)
  },

  accounts: {
    list: (): Promise<IPCResult<BkAccountRow[]>> => invoke(EXT_BOOKKEEPING_IPC.ACCOUNTS_LIST, {}),

    create: (data: {
      name: string
      type: string
      openingBalance?: number
    }): Promise<IPCResult<BkAccountRow>> => invoke(EXT_BOOKKEEPING_IPC.ACCOUNTS_CREATE, data),

    update: (
      id: string,
      data: { name?: string; openingBalance?: number }
    ): Promise<IPCResult<BkAccountRow>> =>
      invoke(EXT_BOOKKEEPING_IPC.ACCOUNTS_UPDATE, { id, ...data }),

    linkPlaid: (id: string, plaidAccountId: string): Promise<IPCResult> =>
      invoke(EXT_BOOKKEEPING_IPC.ACCOUNTS_LINK_PLAID, { id, plaidAccountId })
  },

  categories: {
    list: (type?: 'income' | 'expense' | 'all'): Promise<IPCResult<BkCategoryRow[]>> =>
      invoke(EXT_BOOKKEEPING_IPC.CATEGORIES_LIST, { type }),

    create: (data: {
      name: string
      type: 'income' | 'expense'
      parentId?: string
      taxCategory?: string
    }): Promise<IPCResult<BkCategoryRow>> => invoke(EXT_BOOKKEEPING_IPC.CATEGORIES_CREATE, data),

    update: (
      id: string,
      data: { name?: string; parentId?: string | null; taxCategory?: string }
    ): Promise<IPCResult<BkCategoryRow>> =>
      invoke(EXT_BOOKKEEPING_IPC.CATEGORIES_UPDATE, { id, ...data }),

    delete: (id: string): Promise<IPCResult> =>
      invoke(EXT_BOOKKEEPING_IPC.CATEGORIES_DELETE, { id })
  },

  transactions: {
    list: (opts?: {
      accountId?: string
      categoryId?: string
      startDate?: string
      endDate?: string
      uncategorized?: boolean
      limit?: number
      offset?: number
    }): Promise<IPCResult<BkTransactionRow[]>> =>
      invoke(EXT_BOOKKEEPING_IPC.TRANSACTIONS_LIST, opts ?? {}),

    get: (id: string): Promise<IPCResult<BkTransactionRow>> =>
      invoke(EXT_BOOKKEEPING_IPC.TRANSACTIONS_GET, { id }),

    create: (data: {
      date: string
      amount: number
      description: string
      payee?: string
      accountId: string
      categoryId?: string
      notes?: string
    }): Promise<IPCResult<BkTransactionRow>> =>
      invoke(EXT_BOOKKEEPING_IPC.TRANSACTIONS_CREATE, data),

    update: (
      id: string,
      data: {
        date?: string
        amount?: number
        description?: string
        payee?: string
        categoryId?: string | null
        notes?: string
      }
    ): Promise<IPCResult<BkTransactionRow>> =>
      invoke(EXT_BOOKKEEPING_IPC.TRANSACTIONS_UPDATE, { id, ...data }),

    delete: (id: string): Promise<IPCResult> =>
      invoke(EXT_BOOKKEEPING_IPC.TRANSACTIONS_DELETE, { id }),

    bulkCategorize: (ids: string[], categoryId: string): Promise<IPCResult> =>
      invoke(EXT_BOOKKEEPING_IPC.TRANSACTIONS_BULK_CATEGORIZE, { ids, categoryId })
  },

  ai: {
    categorize: (transactionId: string): Promise<IPCResult<CategorizationResult>> =>
      invoke(EXT_BOOKKEEPING_IPC.AI_CATEGORIZE, { transactionId }),

    categorizeBatch: (opts?: {
      transactionIds?: string[]
      uncategorizedOnly?: boolean
    }): Promise<IPCResult<{ processed: number; applied: number }>> =>
      invoke(EXT_BOOKKEEPING_IPC.AI_CATEGORIZE_BATCH, opts ?? {})
  },

  import: {
    fromPlaid: (accountId?: string): Promise<IPCResult<{ imported: number; skipped: number }>> =>
      invoke(EXT_BOOKKEEPING_IPC.IMPORT_FROM_PLAID, { accountId }),

    fromStripe: (): Promise<IPCResult<{ imported: number; skipped: number }>> =>
      invoke(EXT_BOOKKEEPING_IPC.IMPORT_FROM_STRIPE, {}),

    fromCsv: (data: {
      accountId: string
      filePath: string
      dateColumn?: string
      amountColumn?: string
      descriptionColumn?: string
    }): Promise<IPCResult<{ imported: number }>> =>
      invoke(EXT_BOOKKEEPING_IPC.IMPORT_FROM_CSV, data)
  },

  reports: {
    profitLoss: (startDate: string, endDate: string): Promise<IPCResult<ProfitLossReport>> =>
      invoke(EXT_BOOKKEEPING_IPC.REPORT_PROFIT_LOSS, { startDate, endDate }),

    cashFlow: (startDate: string, endDate: string): Promise<IPCResult<CashFlowReport>> =>
      invoke(EXT_BOOKKEEPING_IPC.REPORT_CASH_FLOW, { startDate, endDate }),

    tax: (
      year: number
    ): Promise<IPCResult<{ report: TaxReport; scheduleC: Record<string, number> }>> =>
      invoke(EXT_BOOKKEEPING_IPC.REPORT_TAX, { year })
  },

  export: {
    csv: (opts?: {
      startDate?: string
      endDate?: string
      accountId?: string
    }): Promise<IPCResult<{ csv: string; count: number }>> =>
      invoke(EXT_BOOKKEEPING_IPC.EXPORT_CSV, opts ?? {}),

    quickbooks: (
      startDate: string,
      endDate: string
    ): Promise<IPCResult<{ iif: string; count: number }>> =>
      invoke(EXT_BOOKKEEPING_IPC.EXPORT_QUICKBOOKS, { startDate, endDate })
  }
}

export type { IPCResult }
