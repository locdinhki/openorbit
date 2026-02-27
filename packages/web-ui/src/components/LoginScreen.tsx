import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'

function getInitialValues(): { wsUrl: string; token: string; autoConnect: boolean } {
  const hash = window.location.hash.substring(1)
  const params = new URLSearchParams(hash)
  const urlParam = params.get('wsUrl')
  const tokenParam = params.get('token')

  if (urlParam && tokenParam) {
    return { wsUrl: urlParam, token: tokenParam, autoConnect: true }
  }

  const savedUrl = localStorage.getItem('oo-ws-url')
  const savedToken = localStorage.getItem('oo-token')
  if (savedUrl && savedToken) {
    return { wsUrl: savedUrl, token: savedToken, autoConnect: true }
  }

  const host = window.location.hostname
  return { wsUrl: `ws://${host}:18790`, token: '', autoConnect: false }
}

const initial = getInitialValues()

export default function LoginScreen(): React.JSX.Element {
  const { connect, connecting, connectionError } = useStore()
  const [wsUrl, setWsUrl] = useState(initial.wsUrl)
  const [token, setToken] = useState(initial.token)
  const autoConnected = useRef(false)

  useEffect(() => {
    if (initial.autoConnect && !autoConnected.current) {
      autoConnected.current = true
      connect(initial.wsUrl, initial.token).catch(() => {})
    }
  }, [connect])

  const handleConnect = async (): Promise<void> => {
    if (!wsUrl || !token) return
    try {
      await connect(wsUrl, token)
    } catch {
      // error handled by store
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen px-6">
      <div className="mb-8 text-center">
        <div className="text-3xl mb-2">&#127760;</div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--cos-text-primary)' }}>
          OpenOrbit
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--cos-text-muted)' }}>
          Connect to your desktop app
        </p>
      </div>

      <div className="w-full max-w-sm space-y-3">
        <input
          type="text"
          value={wsUrl}
          onChange={(e) => setWsUrl(e.target.value)}
          placeholder="ws://192.168.1.x:18790"
          className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
          style={{
            background: 'var(--cos-bg-tertiary)',
            border: '1px solid var(--cos-border)',
            color: 'var(--cos-text-primary)'
          }}
        />
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Auth token"
          onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
          className="w-full px-3 py-2.5 text-sm rounded-lg outline-none"
          style={{
            background: 'var(--cos-bg-tertiary)',
            border: '1px solid var(--cos-border)',
            color: 'var(--cos-text-primary)'
          }}
        />
        {connectionError && (
          <p className="text-xs" style={{ color: 'var(--cos-error)' }}>
            {connectionError}
          </p>
        )}
        <button
          onClick={handleConnect}
          disabled={connecting || !wsUrl || !token}
          className="w-full py-2.5 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          style={{ background: 'var(--cos-accent)' }}
        >
          {connecting ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  )
}
