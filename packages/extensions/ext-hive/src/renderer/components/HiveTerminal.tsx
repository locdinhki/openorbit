// ============================================================================
// ext-hive — Native Terminal (xterm.js in Electron renderer)
// ============================================================================

import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useExtHiveStore } from '../store/index'
import { ipc } from '../lib/ipc-client'

export default function HiveTerminal(): React.JSX.Element {
  const devices = useExtHiveStore((s) => s.devices)
  const loadDevices = useExtHiveStore((s) => s.loadDevices)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  const onlineDevices = devices.filter((d) => d.status === 'online')

  function connect(deviceId: string): void {
    disconnect()
    setError(null)
    setConnected(false)

    ipc.openTerminal(deviceId).then((res) => {
      if (!res.success || !res.data) {
        setError(res.error ?? 'Failed to get terminal URL')
        return
      }

      if (!containerRef.current) return

      const term = new Terminal({
        cursorBlink: true,
        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
        fontSize: 13,
        theme: {
          background: '#0d0d0d',
          foreground: '#e5e5e5',
          cursor: '#e5e5e5',
          selectionBackground: '#264f78'
        }
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.loadAddon(new WebLinksAddon())
      term.open(containerRef.current)
      fitAddon.fit()

      termRef.current = term
      fitAddonRef.current = fitAddon

      const ws = new WebSocket(res.data.wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'pty-open',
            cols: term.cols,
            rows: term.rows
          })
        )
        setConnected(true)
      }

      ws.onmessage = (event) => {
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }

        if (msg.type === 'pty-output') {
          term.write(atob(msg.data as string))
        }
        if (msg.type === 'pty-close') {
          term.write('\r\n\x1b[90m[Session closed]\x1b[0m\r\n')
          setConnected(false)
        }
        if (msg.type === 'pty-error') {
          term.write(`\r\n\x1b[31m[Error: ${msg.error}]\x1b[0m\r\n`)
          setConnected(false)
        }
      }

      ws.onclose = () => {
        term.write('\r\n\x1b[90m[Disconnected]\x1b[0m\r\n')
        setConnected(false)
      }

      ws.onerror = () => {
        setError('WebSocket connection failed')
        setConnected(false)
      }

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pty-input', data: btoa(data) }))
        }
      })

      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pty-resize', cols, rows }))
        }
      })

      // ResizeObserver for container
      const observer = new ResizeObserver(() => {
        fitAddon.fit()
      })
      observer.observe(containerRef.current)

      // Store cleanup ref
      ;(containerRef.current as HTMLDivElement & { _observer?: ResizeObserver })._observer =
        observer
    })
  }

  function disconnect(): void {
    if (wsRef.current) {
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close()
      }
      wsRef.current = null
    }
    if (termRef.current) {
      termRef.current.dispose()
      termRef.current = null
    }
    if (containerRef.current) {
      const el = containerRef.current as HTMLDivElement & { _observer?: ResizeObserver }
      el._observer?.disconnect()
      delete el._observer
    }
    fitAddonRef.current = null
    setConnected(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect()
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--cos-border)]">
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="flex-1 text-xs bg-[var(--cos-bg-secondary)] text-[var(--cos-text-primary)] border border-[var(--cos-border)] rounded px-2 py-1 outline-none"
        >
          <option value="">Select device...</option>
          {onlineDevices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.id})
            </option>
          ))}
        </select>

        {!connected ? (
          <button
            onClick={() => selectedDevice && connect(selectedDevice)}
            disabled={!selectedDevice}
            className="text-[10px] font-medium px-3 py-1 rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Connect
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="text-[10px] font-medium px-3 py-1 rounded bg-red-600 text-white hover:bg-red-500 transition-colors"
          >
            Disconnect
          </button>
        )}

        {connected && (
          <span className="text-[10px] text-green-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Connected
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 text-[10px] text-red-400 border-b border-[var(--cos-border)]">
          {error}
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 bg-[#0d0d0d]"
        style={{ padding: connected ? '4px' : 0 }}
      />

      {/* Empty state */}
      {!connected && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-xs text-[var(--cos-text-muted)]">
            {onlineDevices.length === 0
              ? 'No online devices available'
              : 'Select a device and click Connect'}
          </p>
        </div>
      )}
    </div>
  )
}
