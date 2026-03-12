// ============================================================================
// Hive PTY Relay — bridges dashboard WS clients to minion PTY sessions
// ============================================================================

import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'
import { v4 as uuid } from 'uuid'

interface PtySession {
  sessionId: string
  deviceId: string
  dashboardWs: WebSocket
}

export function createPtyRelay(
  httpServer: Server,
  sendToDevice: (deviceId: string, msg: Record<string, unknown>) => boolean,
  onDeviceMessage: (handler: (deviceId: string, msg: Record<string, unknown>) => void) => void,
  controllerApiKey: string
): { wss: WebSocketServer } {
  // Session map: sessionId → PtySession
  const sessions = new Map<string, PtySession>()

  // Create a separate WS server on the same HTTP server, but filtered by path
  const wss = new WebSocketServer({ noServer: true })

  // Handle upgrade requests for /api/pty/:deviceId
  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const match = url.pathname.match(/^\/api\/pty\/([^/]+)$/)
    if (!match) return // Not a PTY request — let the main WSS handle it

    // Auth: check token query param
    const token = url.searchParams.get('token')
    if (controllerApiKey && token !== controllerApiKey) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    const deviceId = decodeURIComponent(match[1])

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, deviceId)
    })
  })

  wss.on('connection', (ws: WebSocket, _req: unknown, deviceId: string) => {
    console.log(`[pty-relay] Dashboard connected for device ${deviceId}`)

    let sessionId: string | null = null

    ws.on('message', (raw) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (msg.type === 'pty-open') {
        sessionId = uuid()
        const session: PtySession = { sessionId, deviceId, dashboardWs: ws }
        sessions.set(sessionId, session)

        // Forward to minion
        const sent = sendToDevice(deviceId, {
          type: 'pty-open',
          sessionId,
          cols: msg.cols,
          rows: msg.rows,
          shell: msg.shell
        })

        if (!sent) {
          ws.send(JSON.stringify({ type: 'pty-error', error: 'Device offline' }))
          ws.close()
          sessions.delete(sessionId)
          sessionId = null
        } else {
          // Confirm session opened to dashboard
          ws.send(JSON.stringify({ type: 'pty-opened', sessionId }))
        }
        return
      }

      if (!sessionId) return

      if (msg.type === 'pty-input') {
        sendToDevice(deviceId, { type: 'pty-input', sessionId, data: msg.data })
        return
      }

      if (msg.type === 'pty-resize') {
        sendToDevice(deviceId, { type: 'pty-resize', sessionId, cols: msg.cols, rows: msg.rows })
        return
      }

      if (msg.type === 'pty-close') {
        sendToDevice(deviceId, { type: 'pty-close', sessionId })
        sessions.delete(sessionId)
        sessionId = null
        return
      }
    })

    ws.on('close', () => {
      console.log(`[pty-relay] Dashboard disconnected for device ${deviceId}`)
      if (sessionId) {
        sendToDevice(deviceId, { type: 'pty-close', sessionId })
        sessions.delete(sessionId)
      }
    })

    ws.on('error', (err) => {
      console.error(`[pty-relay] Error:`, err.message)
    })
  })

  // Route PTY messages from minion back to the correct dashboard client
  onDeviceMessage((deviceId, msg) => {
    const sid = msg.sessionId as string
    if (!sid) return

    const session = sessions.get(sid)
    if (!session || session.deviceId !== deviceId) return

    if (msg.type === 'pty-output') {
      if (session.dashboardWs.readyState === WebSocket.OPEN) {
        session.dashboardWs.send(JSON.stringify(msg))
      }
    }

    if (msg.type === 'pty-close') {
      if (session.dashboardWs.readyState === WebSocket.OPEN) {
        session.dashboardWs.send(JSON.stringify(msg))
      }
      sessions.delete(sid)
    }
  })

  return { wss }
}
