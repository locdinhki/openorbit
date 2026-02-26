import { useState, useEffect, useRef } from 'react'
import { ipc } from '@renderer/lib/ipc-client'
import Button from '@renderer/components/shared/Button'

interface PairingInfo {
  wsUrl: string
  token: string
}

function buildPairingPayload(info: PairingInfo): string {
  return JSON.stringify({ wsUrl: info.wsUrl, token: info.token })
}

function drawQRPlaceholder(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const size = canvas.width

  // Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  // Simple deterministic pixel pattern derived from the text (NOT a real QR code —
  // a real QR library such as `qrcode` should be added for production use)
  ctx.fillStyle = '#1a1a2e'
  const cellSize = size / 21
  let seed = 0
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0

  for (let row = 0; row < 21; row++) {
    for (let col = 0; col < 21; col++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      if ((seed >>> 16) % 2 === 0) {
        ctx.fillRect(col * cellSize, row * cellSize, cellSize - 1, cellSize - 1)
      }
    }
  }

  // Finder patterns (top-left, top-right, bottom-left corners)
  const drawFinder = (x: number, y: number): void => {
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(x * cellSize, y * cellSize, 7 * cellSize, 7 * cellSize)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, 5 * cellSize, 5 * cellSize)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, 3 * cellSize, 3 * cellSize)
  }
  drawFinder(0, 0)
  drawFinder(14, 0)
  drawFinder(0, 14)
}

export default function PairingQR(): React.JSX.Element {
  const [info, setInfo] = useState<PairingInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'url' | 'token' | 'payload' | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true)
      const result = await ipc.rpc.getPairingInfo()
      if (result.success && result.data) {
        setInfo(result.data)
      } else {
        setError(result.error ?? 'Failed to load pairing info')
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (info && canvasRef.current) {
      drawQRPlaceholder(canvasRef.current, buildPairingPayload(info))
    }
  }, [info])

  const copy = async (text: string, field: 'url' | 'token' | 'payload'): Promise<void> => {
    await navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 2000)
  }

  if (loading) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-[var(--cos-text-muted)]">Loading pairing info…</p>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-red-400">{error ?? 'Pairing info unavailable'}</p>
        <p className="text-xs text-[var(--cos-text-muted)] mt-1">
          Make sure the RPC server is running.
        </p>
      </div>
    )
  }

  const payload = buildPairingPayload(info)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--cos-text-primary)] mb-1">
          Mobile Pairing
        </h3>
        <p className="text-xs text-[var(--cos-text-muted)]">
          Scan the code with the OpenOrbit iOS app, or copy the URL and token manually.
        </p>
      </div>

      {/* QR Code canvas */}
      <div className="flex justify-center">
        <div className="p-2 bg-white rounded-md inline-block">
          <canvas ref={canvasRef} width={168} height={168} />
        </div>
      </div>

      {/* WS URL */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-[var(--cos-text-secondary)]">WebSocket URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono px-2 py-1.5 bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded truncate text-[var(--cos-text-primary)]">
            {info.wsUrl}
          </code>
          <Button variant="secondary" size="sm" onClick={() => copy(info.wsUrl, 'url')}>
            {copied === 'url' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Token */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-[var(--cos-text-secondary)]">Auth Token</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono px-2 py-1.5 bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded truncate text-[var(--cos-text-primary)]">
            {info.token.substring(0, 8)}…
          </code>
          <Button variant="secondary" size="sm" onClick={() => copy(info.token, 'token')}>
            {copied === 'token' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Full payload copy */}
      <Button
        variant="primary"
        size="sm"
        className="w-full"
        onClick={() => copy(payload, 'payload')}
      >
        {copied === 'payload' ? 'Copied pairing data!' : 'Copy pairing JSON'}
      </Button>

      <p className="text-xs text-[var(--cos-text-muted)] text-center">
        Both devices must be on the same Wi-Fi network.
      </p>
    </div>
  )
}
