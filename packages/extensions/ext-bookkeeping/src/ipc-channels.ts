// ============================================================================
// ext-bookkeeping — IPC Channel Constants
// ============================================================================

export const EXT_BOOKKEEPING_IPC = {
  // Settings
  SETTINGS_GET: 'ext-bookkeeping:settings-get',
  SETTINGS_SET: 'ext-bookkeeping:settings-set',

  // Accounts
  ACCOUNTS_LIST: 'ext-bookkeeping:accounts-list',
  ACCOUNTS_CREATE: 'ext-bookkeeping:accounts-create',
  ACCOUNTS_UPDATE: 'ext-bookkeeping:accounts-update',
  ACCOUNTS_LINK_PLAID: 'ext-bookkeeping:accounts-link-plaid',

  // Categories
  CATEGORIES_LIST: 'ext-bookkeeping:categories-list',
  CATEGORIES_CREATE: 'ext-bookkeeping:categories-create',
  CATEGORIES_UPDATE: 'ext-bookkeeping:categories-update',
  CATEGORIES_DELETE: 'ext-bookkeeping:categories-delete',

  // Transactions
  TRANSACTIONS_LIST: 'ext-bookkeeping:transactions-list',
  TRANSACTIONS_GET: 'ext-bookkeeping:transactions-get',
  TRANSACTIONS_CREATE: 'ext-bookkeeping:transactions-create',
  TRANSACTIONS_UPDATE: 'ext-bookkeeping:transactions-update',
  TRANSACTIONS_DELETE: 'ext-bookkeeping:transactions-delete',
  TRANSACTIONS_BULK_CATEGORIZE: 'ext-bookkeeping:transactions-bulk-categorize',

  // AI
  AI_CATEGORIZE: 'ext-bookkeeping:ai-categorize',
  AI_CATEGORIZE_BATCH: 'ext-bookkeeping:ai-categorize-batch',

  // Import
  IMPORT_FROM_PLAID: 'ext-bookkeeping:import-from-plaid',
  IMPORT_FROM_STRIPE: 'ext-bookkeeping:import-from-stripe',
  IMPORT_FROM_CSV: 'ext-bookkeeping:import-from-csv',

  // Reports
  REPORT_PROFIT_LOSS: 'ext-bookkeeping:report-profit-loss',
  REPORT_CASH_FLOW: 'ext-bookkeeping:report-cash-flow',
  REPORT_TAX: 'ext-bookkeeping:report-tax',

  // Export
  EXPORT_CSV: 'ext-bookkeeping:export-csv',
  EXPORT_QUICKBOOKS: 'ext-bookkeeping:export-quickbooks',

  // Push events
  IMPORT_PROGRESS: 'ext-bookkeeping:import-progress'
} as const

export type ExtBookkeepingIPCChannel =
  (typeof EXT_BOOKKEEPING_IPC)[keyof typeof EXT_BOOKKEEPING_IPC]
