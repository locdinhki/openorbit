// ============================================================================
// ext-zillow — IPC Channel Constants
//
// All channels are prefixed with "ext-zillow:" and match /^[a-z-]+:[a-z-]+$/
// ============================================================================

export const EXT_ZILLOW_IPC = {
  // Lookup
  SEARCH: 'ext-zillow:search',
  GET_ARV: 'ext-zillow:get-arv',

  // Cache
  CACHE_LIST: 'ext-zillow:cache-list',
  CACHE_DELETE: 'ext-zillow:cache-delete',
  CACHE_PURGE: 'ext-zillow:cache-purge',

  // Push (main → renderer)
  SCRAPE_PROGRESS: 'ext-zillow:scrape-progress'
} as const

export type ExtZillowIPCChannel = (typeof EXT_ZILLOW_IPC)[keyof typeof EXT_ZILLOW_IPC]
