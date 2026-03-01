// ============================================================================
// ext-deal-analyzer — IPC Channel Constants
//
// All channels are prefixed with "ext-deal-analyzer:" and match /^[a-z-]+:[a-z-]+$/
// ============================================================================

export const EXT_DEAL_ANALYZER_IPC = {
  // CRUD - Deals
  DEALS_LIST: 'ext-deal-analyzer:deals-list',
  DEALS_GET: 'ext-deal-analyzer:deals-get',
  DEALS_CREATE: 'ext-deal-analyzer:deals-create',
  DEALS_UPDATE: 'ext-deal-analyzer:deals-update',
  DEALS_DELETE: 'ext-deal-analyzer:deals-delete',

  // Comps
  COMPS_LIST: 'ext-deal-analyzer:comps-list',
  COMPS_ADD: 'ext-deal-analyzer:comps-add',
  COMPS_DELETE: 'ext-deal-analyzer:comps-delete',

  // Expenses
  EXPENSES_LIST: 'ext-deal-analyzer:expenses-list',
  EXPENSES_ADD: 'ext-deal-analyzer:expenses-add',
  EXPENSES_DELETE: 'ext-deal-analyzer:expenses-delete',

  // Analysis
  ANALYZE: 'ext-deal-analyzer:analyze',
  COMPARE: 'ext-deal-analyzer:compare',
  EXPORT_PDF: 'ext-deal-analyzer:export-pdf'
} as const

export type ExtDealAnalyzerIPCChannel =
  (typeof EXT_DEAL_ANALYZER_IPC)[keyof typeof EXT_DEAL_ANALYZER_IPC]
