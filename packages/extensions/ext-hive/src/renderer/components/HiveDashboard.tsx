// ============================================================================
// ext-hive — Embedded Web Dashboard
// ============================================================================

import { useState, useEffect } from 'react'

const api = window.api

function getSetting(key: string): Promise<string | null> {
  return api
    .invoke('settings:get', { key })
    .then((res: unknown) => {
      const r = res as { success?: boolean; data?: unknown }
      return typeof r?.data === 'string' && r.data ? r.data : null
    })
    .catch(() => null)
}

export default function HiveDashboard(): React.JSX.Element {
  const [iframeSrc, setIframeSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getSetting('hive.url'), getSetting('hive.api-key')]).then(([url, apiKey]) => {
      if (url) {
        // Pass API key via hash for auto-login
        const src = apiKey ? `${url}#token=${encodeURIComponent(apiKey)}` : url
        setIframeSrc(src)
      }
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xs text-[var(--cos-text-tertiary)]">Loading...</div>
      </div>
    )
  }

  if (!iframeSrc) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="text-sm text-[var(--cos-text-secondary)] mb-1">Hive Not Configured</div>
        <div className="text-[11px] text-[var(--cos-text-tertiary)]">
          Set <span className="font-mono">hive.url</span> in Settings to connect to your Hive
          dashboard.
        </div>
      </div>
    )
  }

  return (
    <iframe
      src={iframeSrc}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        backgroundColor: '#0a0a0a'
      }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  )
}
