import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../lib/ipc-client'

export function useDevMode() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load(): Promise<void> {
      const result = await ipc.sql.devMode('get')
      if (result.success && result.data) setEnabled(result.data.enabled)
      setLoading(false)
    }
    load()
  }, [])

  const toggle = useCallback(async () => {
    const newValue = !enabled
    const result = await ipc.sql.devMode('set', newValue)
    if (result.success && result.data) setEnabled(result.data.enabled)
  }, [enabled])

  return { enabled, toggle, loading }
}
