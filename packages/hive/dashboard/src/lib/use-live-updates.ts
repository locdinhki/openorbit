import { useEffect, useRef, useCallback } from 'react'
import { getToken } from './api'

export interface LiveEvent {
  event: string
  payload: Record<string, unknown>
}

type EventHandler = (event: LiveEvent) => void

const RECONNECT_BASE = 1000
const RECONNECT_MAX = 30000

/**
 * Opens a persistent WS to /api/ws/dashboard and routes events to the handler.
 * Reconnects with exponential backoff on disconnect.
 */
export function useLiveUpdates(onEvent: EventHandler): void {
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  const connect = useCallback(() => {
    const token = getToken()
    if (!token) return null

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/api/ws/dashboard?token=${encodeURIComponent(token)}`
    return new WebSocket(url)
  }, [])

  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectDelay = RECONNECT_BASE
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let disposed = false

    function setup() {
      if (disposed) return
      ws = connect()
      if (!ws) return

      ws.onopen = () => {
        reconnectDelay = RECONNECT_BASE
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as LiveEvent
          handlerRef.current(data)
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = () => {
        if (disposed) return
        reconnectTimer = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX)
          setup()
        }, reconnectDelay)
      }

      ws.onerror = () => {
        ws?.close()
      }
    }

    setup()

    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [connect])
}
