// ============================================================================
// ext-plaid — Renderer IPC Client
// ============================================================================

import { EXT_PLAID_IPC } from '../../ipc-channels'
import type { PlaidItemRow } from '../../main/db/items-repo'
import type { PlaidAccountRow } from '../../main/db/accounts-repo'
import type { PlaidTransactionRow } from '../../main/db/transactions-repo'

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

export interface PlaidSettings {
  hasCredentials: boolean
  environment: string
}

export const ipc = {
  settings: {
    get: (): Promise<IPCResult<PlaidSettings>> => invoke(EXT_PLAID_IPC.SETTINGS_GET, {}),

    set: (data: {
      clientId?: string
      secret?: string
      environment?: 'sandbox' | 'development' | 'production'
    }): Promise<IPCResult> => invoke(EXT_PLAID_IPC.SETTINGS_SET, data)
  },

  link: {
    createToken: (userId?: string): Promise<IPCResult<{ linkToken: string }>> =>
      invoke(EXT_PLAID_IPC.LINK_TOKEN_CREATE, { userId }),

    exchange: (
      publicToken: string
    ): Promise<IPCResult<{ itemId: string; institutionName?: string; accountCount: number }>> =>
      invoke(EXT_PLAID_IPC.LINK_EXCHANGE, { publicToken })
  },

  items: {
    list: (): Promise<IPCResult<PlaidItemRow[]>> => invoke(EXT_PLAID_IPC.ITEMS_LIST, {}),

    remove: (itemId: string): Promise<IPCResult> => invoke(EXT_PLAID_IPC.ITEMS_REMOVE, { itemId })
  },

  accounts: {
    list: (itemId?: string): Promise<IPCResult<PlaidAccountRow[]>> =>
      invoke(EXT_PLAID_IPC.ACCOUNTS_LIST, { itemId }),

    sync: (itemId?: string): Promise<IPCResult<{ synced: number }>> =>
      invoke(EXT_PLAID_IPC.ACCOUNTS_SYNC, { itemId })
  },

  transactions: {
    list: (opts?: {
      accountId?: string
      startDate?: string
      endDate?: string
      limit?: number
      offset?: number
    }): Promise<IPCResult<PlaidTransactionRow[]>> =>
      invoke(EXT_PLAID_IPC.TRANSACTIONS_LIST, opts ?? {}),

    sync: (
      itemId?: string
    ): Promise<IPCResult<{ added: number; modified: number; removed: number }>> =>
      invoke(EXT_PLAID_IPC.TRANSACTIONS_SYNC, { itemId })
  }
}

export type { IPCResult }
