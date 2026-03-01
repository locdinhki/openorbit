// ============================================================================
// ext-docs — IPC Channel Constants
//
// All channels are prefixed with "ext-docs:" and match /^[a-z-]+:[a-z-]+$/
// ============================================================================

export const EXT_DOCS_IPC = {
  // Documents
  DOCUMENTS_LIST: 'ext-docs:documents-list',
  DOCUMENTS_GET: 'ext-docs:documents-get',
  DOCUMENTS_CREATE: 'ext-docs:documents-create',
  DOCUMENTS_UPDATE: 'ext-docs:documents-update',
  DOCUMENTS_DELETE: 'ext-docs:documents-delete',
  DOCUMENTS_SEARCH: 'ext-docs:documents-search',

  // Templates
  TEMPLATES_LIST: 'ext-docs:templates-list',
  TEMPLATES_GET: 'ext-docs:templates-get',
  TEMPLATES_SAVE: 'ext-docs:templates-save',
  TEMPLATES_DELETE: 'ext-docs:templates-delete',

  // Generation
  GENERATE_FROM_TEMPLATE: 'ext-docs:generate',

  // E-signatures
  SIGN_REQUEST: 'ext-docs:sign-request',
  SIGN_STATUS: 'ext-docs:sign-status',
  SIGN_CANCEL: 'ext-docs:sign-cancel',

  // Settings
  SETTINGS_GET: 'ext-docs:settings-get',
  SETTINGS_SET: 'ext-docs:settings-set'
} as const

export type ExtDocsIPCChannel = (typeof EXT_DOCS_IPC)[keyof typeof EXT_DOCS_IPC]
