import { useEffect, useCallback } from 'react'
import { create } from 'zustand'
import { ipc } from '../lib/ipc-client'

interface DevModeState {
  enabled: boolean
  loading: boolean
  setEnabled: (enabled: boolean) => void
  setLoading: (loading: boolean) => void
}

const useDevModeStore = create<DevModeState>()((set) => ({
  enabled: false,
  loading: true,
  setEnabled: (enabled) => set({ enabled }),
  setLoading: (loading) => set({ loading })
}))

export function useDevMode(): { enabled: boolean; toggle: () => Promise<void>; loading: boolean } {
  const { enabled, loading } = useDevModeStore()

  useEffect(() => {
    async function load(): Promise<void> {
      const result = await ipc.sql.devMode('get')
      if (result.success && result.data) useDevModeStore.getState().setEnabled(result.data.enabled)
      useDevModeStore.getState().setLoading(false)
    }
    load()
  }, [])

  const toggle = useCallback(async () => {
    const current = useDevModeStore.getState().enabled
    const result = await ipc.sql.devMode('set', !current)
    if (result.success && result.data) useDevModeStore.getState().setEnabled(result.data.enabled)
  }, [])

  return { enabled, toggle, loading }
}
