// ============================================================================
// ext-plaid — IPC Channel Constants
// ============================================================================

export const EXT_PLAID_IPC = {
  // Settings
  SETTINGS_GET: 'ext-plaid:settings-get',
  SETTINGS_SET: 'ext-plaid:settings-set',

  // Link
  LINK_TOKEN_CREATE: 'ext-plaid:link-token-create',
  LINK_EXCHANGE: 'ext-plaid:link-exchange',

  // Items (connected banks)
  ITEMS_LIST: 'ext-plaid:items-list',
  ITEMS_REMOVE: 'ext-plaid:items-remove',

  // Accounts
  ACCOUNTS_LIST: 'ext-plaid:accounts-list',
  ACCOUNTS_SYNC: 'ext-plaid:accounts-sync',

  // Transactions
  TRANSACTIONS_LIST: 'ext-plaid:transactions-list',
  TRANSACTIONS_SYNC: 'ext-plaid:transactions-sync',

  // Push events (main → renderer)
  SYNC_PROGRESS: 'ext-plaid:sync-progress'
} as const

export type ExtPlaidIPCChannel = (typeof EXT_PLAID_IPC)[keyof typeof EXT_PLAID_IPC]
