// ============================================================================
// ext-stripe — IPC Channel Constants
// ============================================================================

export const EXT_STRIPE_IPC = {
  // Settings
  SETTINGS_GET: 'ext-stripe:settings-get',
  SETTINGS_SET: 'ext-stripe:settings-set',
  CONNECTION_TEST: 'ext-stripe:connection-test',

  // Customers
  CUSTOMERS_LIST: 'ext-stripe:customers-list',
  CUSTOMERS_GET: 'ext-stripe:customers-get',
  CUSTOMERS_CREATE: 'ext-stripe:customers-create',
  CUSTOMERS_SYNC: 'ext-stripe:customers-sync',

  // Payments
  PAYMENTS_LIST: 'ext-stripe:payments-list',
  PAYMENTS_SYNC: 'ext-stripe:payments-sync',
  PAYMENTS_REFUND: 'ext-stripe:payments-refund',

  // Payment Links
  PAYMENT_LINKS_CREATE: 'ext-stripe:payment-links-create',
  PAYMENT_LINKS_LIST: 'ext-stripe:payment-links-list',

  // Subscriptions
  SUBS_LIST: 'ext-stripe:subs-list',
  SUBS_SYNC: 'ext-stripe:subs-sync',
  SUBS_CANCEL: 'ext-stripe:subs-cancel',

  // Dashboard
  DASHBOARD_METRICS: 'ext-stripe:dashboard-metrics',

  // Push events (main → renderer)
  SYNC_PROGRESS: 'ext-stripe:sync-progress'
} as const

export type ExtStripeIPCChannel = (typeof EXT_STRIPE_IPC)[keyof typeof EXT_STRIPE_IPC]
