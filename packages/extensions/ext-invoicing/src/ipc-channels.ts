// ============================================================================
// ext-invoicing — IPC Channel Constants
// ============================================================================

export const EXT_INVOICING_IPC = {
  // Settings
  SETTINGS_GET: 'ext-invoicing:settings-get',
  SETTINGS_SET: 'ext-invoicing:settings-set',

  // Invoices
  INVOICES_LIST: 'ext-invoicing:invoices-list',
  INVOICES_GET: 'ext-invoicing:invoices-get',
  INVOICES_CREATE: 'ext-invoicing:invoices-create',
  INVOICES_UPDATE: 'ext-invoicing:invoices-update',
  INVOICES_DELETE: 'ext-invoicing:invoices-delete',

  // Invoice Actions
  INVOICES_SEND: 'ext-invoicing:invoices-send',
  INVOICES_MARK_PAID: 'ext-invoicing:invoices-mark-paid',
  INVOICES_VOID: 'ext-invoicing:invoices-void',
  INVOICES_DOWNLOAD_PDF: 'ext-invoicing:invoices-download-pdf',
  INVOICES_CREATE_PAYMENT_LINK: 'ext-invoicing:invoices-create-payment-link',

  // Templates
  TEMPLATES_LIST: 'ext-invoicing:templates-list',
  TEMPLATES_CREATE: 'ext-invoicing:templates-create',
  TEMPLATES_UPDATE: 'ext-invoicing:templates-update',
  TEMPLATES_DELETE: 'ext-invoicing:templates-delete',

  // Recurring
  RECURRING_LIST: 'ext-invoicing:recurring-list',
  RECURRING_CREATE: 'ext-invoicing:recurring-create',
  RECURRING_UPDATE: 'ext-invoicing:recurring-update',
  RECURRING_PAUSE: 'ext-invoicing:recurring-pause',

  // Payments
  PAYMENTS_LIST: 'ext-invoicing:payments-list',
  PAYMENTS_RECORD: 'ext-invoicing:payments-record',

  // Dashboard
  DASHBOARD_STATS: 'ext-invoicing:dashboard-stats'
} as const

export type ExtInvoicingIPCChannel = (typeof EXT_INVOICING_IPC)[keyof typeof EXT_INVOICING_IPC]
