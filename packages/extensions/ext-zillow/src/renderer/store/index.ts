// ============================================================================
// ext-zillow — Extension Zustand Store
// ============================================================================

import { create } from 'zustand'
import type { ArvCacheRow } from '../../main/db/arv-cache-repo'
import { ipc } from '../lib/ipc-client'

interface ExtZillowStore {
  // Lookup state
  address: { address1: string; city: string; state: string; postalCode: string }
  setAddress: (field: string, value: string) => void
  resetAddress: () => void
  searching: boolean
  result: ArvCacheRow | null
  error: string | null
  search: () => Promise<void>

  // Cache state
  cacheItems: ArvCacheRow[]
  cacheLoading: boolean
  loadCache: () => Promise<void>
  deleteCache: (id: string) => Promise<void>
  purgeCache: () => Promise<void>

  // Workspace
  selectedLookup: ArvCacheRow | null
  setSelectedLookup: (item: ArvCacheRow | null) => void
}

const emptyAddress = { address1: '', city: '', state: '', postalCode: '' }

export const useExtZillowStore = create<ExtZillowStore>()((set, get) => ({
  // Lookup
  address: { ...emptyAddress },
  setAddress: (field, value) => set((s) => ({ address: { ...s.address, [field]: value } })),
  resetAddress: () => set({ address: { ...emptyAddress }, result: null, error: null }),
  searching: false,
  result: null,
  error: null,
  search: async () => {
    set({ searching: true, error: null, result: null })
    const res = await ipc.search(get().address)
    if (res.success && res.data) {
      set({ searching: false, result: res.data, selectedLookup: res.data })
    } else {
      set({ searching: false, error: res.error ?? 'Search failed' })
    }
  },

  // Cache
  cacheItems: [],
  cacheLoading: false,
  loadCache: async () => {
    set({ cacheLoading: true })
    const res = await ipc.cache.list()
    if (res.success && res.data) {
      set({ cacheItems: res.data, cacheLoading: false })
    } else {
      set({ cacheLoading: false })
    }
  },
  deleteCache: async (id) => {
    await ipc.cache.delete(id)
    set((s) => ({ cacheItems: s.cacheItems.filter((c) => c.id !== id) }))
  },
  purgeCache: async () => {
    await ipc.cache.purge()
    set({ cacheItems: [] })
  },

  // Workspace
  selectedLookup: null,
  setSelectedLookup: (item) => set({ selectedLookup: item })
}))

export const useStore = useExtZillowStore
