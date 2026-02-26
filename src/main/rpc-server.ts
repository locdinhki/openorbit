import { WebSocket, WebSocketServer } from 'ws'
import type { IncomingMessage } from 'http'
import { randomUUID } from 'crypto'
import { createLogger } from '@openorbit/core/utils/logger'
import { getCoreEventBus } from '@openorbit/core/automation/core-events'

const log = createLogger('RPCServer')

export const RPC_PORT = 18790

export type RPCHandler = (params: Record<string, unknown>) => Promise<unknown> | unknown

type AuthenticatedSocket = WebSocket & { authenticated: boolean; isRelay?: boolean; tabId?: number }

interface PendingCDPCall {
  resolve: (result: unknown) => void
  reject: (err: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

interface JsonRpcRequest {
  id?: string | number
  method: string
  params?: Record<string, unknown>
}

/**
 * JSON-RPC 2.0 WebSocket server on localhost:18790.
 * Clients must authenticate first with { method: "auth", params: { token } }.
 * After auth, any registered method can be invoked.
 * Core events are broadcast as push notifications to all authenticated clients.
 */
export class RPCServer {
  private wss: WebSocketServer | null = null
  private handlers = new Map<string, RPCHandler>()
  private readonly token: string
  private readonly port: number
  private eventUnsubscribers: Array<() => void> = []

  // Relay: sockets acting as CDP proxy (Chrome extension)
  private relaySockets = new Map<number, AuthenticatedSocket>() // tabId → socket
  private pendingCDP = new Map<string, PendingCDPCall>() // commandId → pending

  private readonly host: string

  constructor(opts: { token: string; port?: number; host?: string }) {
    this.token = opts.token
    this.port = opts.port ?? RPC_PORT
    this.host = opts.host ?? '127.0.0.1'
  }

  getHost(): string {
    return this.host
  }

  getPort(): number {
    return this.port
  }

  register(method: string, handler: RPCHandler): void {
    this.handlers.set(method, handler)
  }

  /** Send a CDP command to the extension relay for the given tabId. */
  sendRelayCommand(
    tabId: number,
    cdpMethod: string,
    cdpParams: Record<string, unknown> = {}
  ): Promise<unknown> {
    const socket = this.relaySockets.get(tabId)
    if (!socket) {
      return Promise.reject(new Error(`No relay attached for tab ${tabId}`))
    }

    const commandId = randomUUID()
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCDP.delete(commandId)
        reject(new Error(`CDP command timeout: ${cdpMethod}`))
      }, 30_000)

      this.pendingCDP.set(commandId, { resolve, reject, timeout })

      socket.send(
        JSON.stringify({
          method: 'relay.command',
          params: { commandId, tabId, cdpMethod, cdpParams }
        })
      )
    })
  }

  /** Resolve a pending CDP call (called when relay.result arrives). */
  resolveRelayCommand(commandId: string, result: unknown, error?: string | null): void {
    const pending = this.pendingCDP.get(commandId)
    if (!pending) return
    clearTimeout(pending.timeout)
    this.pendingCDP.delete(commandId)
    if (error) {
      pending.reject(new Error(error))
    } else {
      pending.resolve(result)
    }
  }

  /** Returns tabIds of all currently attached relay sessions. */
  getRelayTabIds(): number[] {
    return Array.from(this.relaySockets.keys())
  }

  start(): void {
    if (this.host !== '127.0.0.1' && this.host !== 'localhost') {
      log.warn(`RPC server binding to ${this.host} — ensure network is trusted (use Tailscale)`)
    }
    this.wss = new WebSocketServer({ host: this.host, port: this.port })

    // Bridge CoreEventBus → push notifications to authenticated clients
    const bus = getCoreEventBus()
    const push = (event: string, data: unknown): void => {
      this.broadcast({ method: 'push', params: { event, data } })
    }

    const onStatus = (status: unknown): void => push('automation:status', status)
    const onJob = (job: unknown): void => push('jobs:new', job)
    const onProgress = (data: unknown): void => push('application:progress', data)
    const onQuestion = (data: unknown): void => push('application:pause-question', data)
    const onComplete = (data: unknown): void => push('application:complete', data)

    bus.on('automation:status', onStatus)
    bus.on('jobs:new', onJob)
    bus.on('application:progress', onProgress)
    bus.on('application:pause-question', onQuestion)
    bus.on('application:complete', onComplete)

    this.eventUnsubscribers = [
      () => bus.off('automation:status', onStatus),
      () => bus.off('jobs:new', onJob),
      () => bus.off('application:progress', onProgress),
      () => bus.off('application:pause-question', onQuestion),
      () => bus.off('application:complete', onComplete)
    ]

    this.wss.on('connection', (ws: AuthenticatedSocket, req: IncomingMessage) => {
      log.debug(`RPC client connected from ${req.socket.remoteAddress}`)
      ws.authenticated = false

      ws.on('message', async (raw) => {
        let msg: JsonRpcRequest
        try {
          msg = JSON.parse(String(raw)) as JsonRpcRequest
        } catch {
          ws.send(JSON.stringify({ id: null, error: { code: -32700, message: 'Parse error' } }))
          return
        }

        const { id, method, params = {} } = msg

        if (!ws.authenticated) {
          if (method !== 'auth') {
            ws.send(JSON.stringify({ id, error: { code: -32000, message: 'Not authenticated' } }))
            ws.close(1008, 'Not authenticated')
            return
          }
          if (params['token'] !== this.token) {
            ws.send(JSON.stringify({ id, error: { code: -32001, message: 'Invalid token' } }))
            ws.close(1008, 'Invalid token')
            return
          }
          ws.authenticated = true
          ws.send(JSON.stringify({ id, result: { ok: true } }))
          log.info('RPC client authenticated')
          return
        }

        // Handle relay protocol methods before normal dispatch
        if (method === 'relay.attach') {
          const tabId = params['tabId'] as number
          const url = (params['url'] as string) || ''
          ws.isRelay = true
          ws.tabId = tabId
          this.relaySockets.set(tabId, ws)
          log.info(`Relay attached: tab ${tabId} (${url})`)
          getCoreEventBus().emit('relay:attached', { tabId, url })
          ws.send(JSON.stringify({ id, result: { ok: true } }))
          return
        }

        if (method === 'relay.detach') {
          const tabId = ws.tabId ?? (params['tabId'] as number)
          if (tabId != null) {
            this.relaySockets.delete(tabId)
            getCoreEventBus().emit('relay:detached', { tabId })
            log.info(`Relay detached: tab ${tabId}`)
          }
          ws.send(JSON.stringify({ id, result: { ok: true } }))
          return
        }

        if (method === 'relay.result') {
          const commandId = params['commandId'] as string
          const error = params['error'] as string | null | undefined
          this.resolveRelayCommand(commandId, params['result'], error)
          ws.send(JSON.stringify({ id, result: { ok: true } }))
          return
        }

        if (method === 'relay.event') {
          // Forward CDP event to any listeners (e.g. RelayPage waiting for Page.loadEventFired)
          getCoreEventBus().emit('relay:cdp-event', {
            tabId: params['tabId'] as number,
            cdpEvent: params['cdpEvent'] as string,
            cdpParams: params['cdpParams']
          })
          ws.send(JSON.stringify({ id, result: { ok: true } }))
          return
        }

        const handler = this.handlers.get(method)
        if (!handler) {
          ws.send(
            JSON.stringify({ id, error: { code: -32601, message: `Method not found: ${method}` } })
          )
          return
        }

        try {
          const result = await handler(params)
          ws.send(JSON.stringify({ id, result }))
        } catch (err) {
          log.error(`Handler '${method}' threw`, err)
          ws.send(
            JSON.stringify({
              id,
              error: { code: -32000, message: err instanceof Error ? err.message : String(err) }
            })
          )
        }
      })

      ws.on('close', () => log.debug('RPC client disconnected'))
      ws.on('error', (err) => log.error('RPC socket error', err))
    })

    this.wss.on('listening', () => {
      log.info(`RPC server listening on ws://${this.host}:${this.port}`)
    })

    this.wss.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        log.warn(`RPC port ${this.port} already in use — server not started`)
      } else {
        log.error('RPC server error', err)
      }
    })
  }

  destroy(): void {
    for (const unsub of this.eventUnsubscribers) unsub()
    this.eventUnsubscribers = []

    // Reject all pending CDP calls
    for (const { reject, timeout } of this.pendingCDP.values()) {
      clearTimeout(timeout)
      reject(new Error('RPC server destroyed'))
    }
    this.pendingCDP.clear()
    this.relaySockets.clear()

    if (this.wss) {
      this.wss.close()
      this.wss = null
    }
  }

  private broadcast(msg: unknown): void {
    if (!this.wss) return
    const data = JSON.stringify(msg)
    this.wss.clients.forEach((client) => {
      const c = client as AuthenticatedSocket
      // Skip relay sockets — they receive relay.command pushes, not core event broadcasts
      if (c.readyState === WebSocket.OPEN && c.authenticated && !c.isRelay) {
        c.send(data)
      }
    })
  }
}
