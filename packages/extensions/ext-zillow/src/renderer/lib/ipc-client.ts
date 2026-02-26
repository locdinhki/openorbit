// ============================================================================
// ext-zillow — Renderer IPC Client
// ============================================================================

import { EXT_ZILLOW_IPC } from '../../ipc-channels'
import type { ArvCacheRow } from '../../main/db/arv-cache-repo'

interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

const api = window.api

export const ipc = {
  search: (address: {
    address1: string
    city: string
    state: string
    postalCode: string
  }): Promise<IPCResult<ArvCacheRow>> =>
    api.invoke(EXT_ZILLOW_IPC.SEARCH, address) as Promise<IPCResult<ArvCacheRow>>,

  getArv: (address: {
    address1: string
    city: string
    state: string
    postalCode: string
  }): Promise<IPCResult<ArvCacheRow>> =>
    api.invoke(EXT_ZILLOW_IPC.GET_ARV, address) as Promise<IPCResult<ArvCacheRow>>,

  cache: {
    list: (limit = 100): Promise<IPCResult<ArvCacheRow[]>> =>
      api.invoke(EXT_ZILLOW_IPC.CACHE_LIST, { limit }) as Promise<IPCResult<ArvCacheRow[]>>,

    delete: (id: string): Promise<IPCResult> =>
      api.invoke(EXT_ZILLOW_IPC.CACHE_DELETE, { id }) as Promise<IPCResult>,

    purge: (): Promise<IPCResult<{ purged: number }>> =>
      api.invoke(EXT_ZILLOW_IPC.CACHE_PURGE, {}) as Promise<IPCResult<{ purged: number }>>
  }
}

export type { IPCResult }
