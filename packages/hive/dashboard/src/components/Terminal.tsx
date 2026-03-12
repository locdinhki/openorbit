import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

interface Props {
  deviceId: string
  token: string
}

export default function Terminal({ deviceId, token }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      fontSize: 14,
      theme: {
        background: '#0a0a0a',
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

    // Connect WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/pty/${encodeURIComponent(deviceId)}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'pty-open',
          cols: term.cols,
          rows: term.rows
        })
      )
    }

    ws.onmessage = (event) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }

      if (msg.type === 'pty-output') {
        // Decode base64 output and write to terminal
        term.write(atob(msg.data as string))
      }

      if (msg.type === 'pty-close') {
        term.write('\r\n\x1b[90m[Session closed]\x1b[0m\r\n')
      }

      if (msg.type === 'pty-error') {
        term.write(`\r\n\x1b[31m[Error: ${msg.error}]\x1b[0m\r\n`)
      }
    }

    ws.onclose = () => {
      term.write('\r\n\x1b[90m[Disconnected]\x1b[0m\r\n')
    }

    // Send keystrokes to minion
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'pty-input',
            data: btoa(data)
          })
        )
      }
    })

    // Resize handling
    const observer = new ResizeObserver(() => {
      fitAddon.fit()
    })
    observer.observe(containerRef.current)

    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'pty-resize', cols, rows }))
      }
    })

    return () => {
      observer.disconnect()
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      term.dispose()
      termRef.current = null
      wsRef.current = null
    }
  }, [deviceId, token])

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] bg-[#0a0a0a] rounded-lg overflow-hidden"
    />
  )
}
