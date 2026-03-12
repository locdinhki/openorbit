// ============================================================================
// Dashboard Hub — WebSocket push to dashboard clients
// ============================================================================

import { WebSocketServer, type WebSocket } from 'ws'
import type { Server } from 'node:http'
import type { Store } from './store.js'

export type DashboardEvent =
  | { event: 'device.status'; payload: { deviceId: string; status: string; lastSeenAt: string } }
  | { event: 'device.metrics'; payload: { deviceId: string; metrics: Record<string, number> } }
  | { event: 'task.created'; payload: { task: Record<string, unknown> } }
  | { event: 'task.updated'; payload: { taskId: string; status: string; completedAt?: string } }
  | { event: 'alert.fired'; payload: { alert: Record<string, unknown> } }
  | { event: 'alert.resolved'; payload: { alertId: string; resolvedAt: string } }

export class DashboardHub {
  private clients = new Set<WebSocket>()

  add(ws: WebSocket): void {
    this.clients.add(ws)
    ws.on('close', () => this.clients.delete(ws))
    ws.on('error', () => this.clients.delete(ws))
  }

  remove(ws: WebSocket): void {
    this.clients.delete(ws)
  }

  broadcast(event: string, payload: unknown): void {
    const msg = JSON.stringify({ event, payload })
    for (const ws of this.clients) {
      if (ws.readyState === ws.OPEN) {
        ws.send(msg)
      }
    }
  }

  get clientCount(): number {
    return this.clients.size
  }
}

/**
 * Register WS upgrade handler for /api/ws/dashboard.
 * Sends initial device snapshot on connect, then pushes events via hub.broadcast().
 */
export function createDashboardWs(
  httpServer: Server,
  hub: DashboardHub,
  store: Store,
  controllerApiKey: string
): void {
  const wss = new WebSocketServer({ noServer: true })

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    if (url.pathname !== '/api/ws/dashboard') return

    // Auth
    const token = url.searchParams.get('token')
    if (controllerApiKey && token !== controllerApiKey) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws)
    })
  })

  wss.on('connection', async (ws: WebSocket) => {
    console.log('[dashboard-hub] Client connected')
    hub.add(ws)

    // Send initial snapshot of all device statuses
    try {
      const devices = await store.listDevices()
      const snapshot = devices.map((d) => ({
        deviceId: d.id,
        status: d.status,
        lastSeenAt: d.lastSeenAt?.toISOString() ?? null
      }))
      ws.send(JSON.stringify({ event: 'snapshot', payload: { devices: snapshot } }))
    } catch (err) {
      console.error('[dashboard-hub] Snapshot failed:', err)
    }
  })
}
