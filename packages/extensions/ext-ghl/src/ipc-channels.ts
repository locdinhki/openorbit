// ============================================================================
// ext-ghl — IPC Channel Constants
//
// All channels are prefixed with "ext-ghl:" and match /^[a-z-]+:[a-z-]+$/
// ============================================================================

export const EXT_GHL_IPC = {
  // Settings
  SETTINGS_GET: 'ext-ghl:settings-get',
  SETTINGS_SET: 'ext-ghl:settings-set',
  CONNECTION_TEST: 'ext-ghl:connection-test',

  // Contacts
  CONTACTS_LIST: 'ext-ghl:contacts-list',
  CONTACTS_GET: 'ext-ghl:contacts-get',
  CONTACTS_CREATE: 'ext-ghl:contacts-create',
  CONTACTS_UPDATE: 'ext-ghl:contacts-update',
  CONTACTS_DELETE: 'ext-ghl:contacts-delete',
  CONTACTS_SYNC: 'ext-ghl:contacts-sync',

  // Pipelines
  PIPELINES_LIST: 'ext-ghl:pipelines-list',

  // Opportunities
  OPPS_LIST: 'ext-ghl:opps-list',
  OPPS_GET: 'ext-ghl:opps-get',
  OPPS_CREATE: 'ext-ghl:opps-create',
  OPPS_UPDATE: 'ext-ghl:opps-update',
  OPPS_UPDATE_STATUS: 'ext-ghl:opps-update-status',
  OPPS_DELETE: 'ext-ghl:opps-delete',
  OPPS_SYNC: 'ext-ghl:opps-sync',

  // Conversations (live API)
  CONVS_LIST: 'ext-ghl:convs-list',
  CONVS_GET: 'ext-ghl:convs-get',
  CONVS_MESSAGES: 'ext-ghl:convs-messages',
  CONVS_SEND: 'ext-ghl:convs-send',

  // Calendars (live API)
  CALS_LIST: 'ext-ghl:cals-list',
  CAL_EVENTS_LIST: 'ext-ghl:cal-events-list',

  // AI Chat
  CHAT_SEND: 'ext-ghl:chat-send',
  CHAT_CLEAR: 'ext-ghl:chat-clear',

  // ARV Enrichment
  ARV_ENRICH_START: 'ext-ghl:arv-enrich-start',
  ARV_ENRICH_STATUS: 'ext-ghl:arv-enrich-status',

  // Custom Fields
  CUSTOM_FIELDS_LIST: 'ext-ghl:custom-fields-list',

  // Push events (main → renderer)
  SYNC_PROGRESS: 'ext-ghl:sync-progress',
  ARV_ENRICH_PROGRESS: 'ext-ghl:arv-enrich-progress'
} as const

export type ExtGhlIPCChannel = (typeof EXT_GHL_IPC)[keyof typeof EXT_GHL_IPC]
