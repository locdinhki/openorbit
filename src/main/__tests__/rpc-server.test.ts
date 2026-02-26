/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// --- Hoisted mocks ---

const { mockWsOn, mockWsClose, mockWsClients, MockWebSocket, MockWebSocketServer } = vi.hoisted(
  () => {
    const mockWsOn = vi.fn()
    const mockWsClose = vi.fn()
    const mockWsClients = new Set<any>()

    const MockWebSocket = vi.fn().mockImplementation(function (this: any) {
      this.on = vi.fn()
      this.send = vi.fn()
      this.close = mockWsClose
      this.readyState = 1 // OPEN
      this.authenticated = false
    })
    ;(MockWebSocket as any).OPEN = 1

    const MockWebSocketServer = vi.fn().mockImplementation(function (this: any) {
      this.on = mockWsOn
      this.close = mockWsClose
      this.clients = mockWsClients
    })

    return { mockWsOn, mockWsClose, mockWsClients, MockWebSocket, MockWebSocketServer }
  }
)

vi.mock('ws', () => ({
  WebSocket: MockWebSocket,
  WebSocketServer: MockWebSocketServer
}))

vi.mock('@openorbit/core/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

vi.mock('@openorbit/core/automation/core-events', () => ({
  getCoreEventBus: () => ({
    on: vi.fn(),
    off: vi.fn()
  })
}))

import { RPCServer } from '../rpc-server'

const TOKEN = 'test-token-abc123'

function makeServer(): RPCServer {
  return new RPCServer({ token: TOKEN, port: 18799 })
}

function getConnectionHandler(): (ws: any, req: any) => void {
  const call = mockWsOn.mock.calls.find((c: any[]) => c[0] === 'connection')
  if (!call) throw new Error('No connection handler registered')
  return call[1]
}

function makeSocket(): any {
  const ws = {
    authenticated: false,
    readyState: 1,
    send: vi.fn(),
    close: vi.fn(),
    on: vi.fn()
  }
  return ws
}

function getMessageHandler(ws: any): (raw: Buffer | string) => Promise<void> {
  const call = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')
  return call[1]
}

describe('RPCServer', () => {
  let server: RPCServer

  beforeEach(() => {
    vi.clearAllMocks()
    mockWsClients.clear()
    server = makeServer()
    server.start()
  })

  afterEach(() => {
    server.destroy()
  })

  it('starts a WebSocketServer on 127.0.0.1 by default', () => {
    expect(MockWebSocketServer).toHaveBeenCalledWith({ host: '127.0.0.1', port: 18799 })
  })

  it('accepts a custom host parameter', () => {
    vi.clearAllMocks()
    const custom = new RPCServer({ token: TOKEN, port: 18799, host: '0.0.0.0' })
    custom.start()
    expect(MockWebSocketServer).toHaveBeenCalledWith({ host: '0.0.0.0', port: 18799 })
    expect(custom.getHost()).toBe('0.0.0.0')
    custom.destroy()
  })

  it('reports host and port via getters', () => {
    expect(server.getHost()).toBe('127.0.0.1')
    expect(server.getPort()).toBe(18799)
  })

  it('registers connection, listening, and error handlers', () => {
    const events = mockWsOn.mock.calls.map((c: any[]) => c[0])
    expect(events).toContain('connection')
    expect(events).toContain('listening')
    expect(events).toContain('error')
  })

  describe('auth', () => {
    it('rejects unauthenticated non-auth message', async () => {
      const connectHandler = getConnectionHandler()
      const ws = makeSocket()
      connectHandler(ws, { socket: { remoteAddress: '127.0.0.1' } })

      const onMessage = getMessageHandler(ws)
      await onMessage(JSON.stringify({ id: 1, method: 'jobs.list', params: {} }))

      const sent = JSON.parse(ws.send.mock.calls[0][0])
      expect(sent.error.code).toBe(-32000)
      expect(ws.close).toHaveBeenCalled()
    })

    it('rejects auth with wrong token', async () => {
      const connectHandler = getConnectionHandler()
      const ws = makeSocket()
      connectHandler(ws, { socket: { remoteAddress: '127.0.0.1' } })

      const onMessage = getMessageHandler(ws)
      await onMessage(JSON.stringify({ id: 1, method: 'auth', params: { token: 'wrong' } }))

      const sent = JSON.parse(ws.send.mock.calls[0][0])
      expect(sent.error.code).toBe(-32001)
      expect(ws.close).toHaveBeenCalled()
    })

    it('authenticates with correct token', async () => {
      const connectHandler = getConnectionHandler()
      const ws = makeSocket()
      connectHandler(ws, { socket: { remoteAddress: '127.0.0.1' } })

      const onMessage = getMessageHandler(ws)
      await onMessage(JSON.stringify({ id: 1, method: 'auth', params: { token: TOKEN } }))

      const sent = JSON.parse(ws.send.mock.calls[0][0])
      expect(sent.result).toEqual({ ok: true })
      expect(ws.authenticated).toBe(true)
    })
  })

  describe('handler dispatch', () => {
    async function authenticate(ws: any, onMessage: (raw: string) => Promise<void>): Promise<void> {
      await onMessage(JSON.stringify({ id: 0, method: 'auth', params: { token: TOKEN } }))
      ws.send.mockClear()
    }

    it('dispatches registered handler after auth', async () => {
      server.register('ping', () => ({ pong: true }))

      const connectHandler = getConnectionHandler()
      const ws = makeSocket()
      connectHandler(ws, { socket: { remoteAddress: '127.0.0.1' } })
      const onMessage = getMessageHandler(ws)
      await authenticate(ws, onMessage)

      await onMessage(JSON.stringify({ id: 2, method: 'ping', params: {} }))

      const sent = JSON.parse(ws.send.mock.calls[0][0])
      expect(sent.result).toEqual({ pong: true })
    })

    it('returns -32601 for unknown method', async () => {
      const connectHandler = getConnectionHandler()
      const ws = makeSocket()
      connectHandler(ws, { socket: { remoteAddress: '127.0.0.1' } })
      const onMessage = getMessageHandler(ws)
      await authenticate(ws, onMessage)

      await onMessage(JSON.stringify({ id: 3, method: 'unknown.method', params: {} }))

      const sent = JSON.parse(ws.send.mock.calls[0][0])
      expect(sent.error.code).toBe(-32601)
    })

    it('returns -32700 for invalid JSON', async () => {
      const connectHandler = getConnectionHandler()
      const ws = makeSocket()
      connectHandler(ws, { socket: { remoteAddress: '127.0.0.1' } })
      const onMessage = getMessageHandler(ws)

      await onMessage('not valid json {{{')

      const sent = JSON.parse(ws.send.mock.calls[0][0])
      expect(sent.error.code).toBe(-32700)
    })

    it('returns error when handler throws', async () => {
      server.register('bad', () => {
        throw new Error('handler failure')
      })

      const connectHandler = getConnectionHandler()
      const ws = makeSocket()
      connectHandler(ws, { socket: { remoteAddress: '127.0.0.1' } })
      const onMessage = getMessageHandler(ws)
      await authenticate(ws, onMessage)

      await onMessage(JSON.stringify({ id: 4, method: 'bad', params: {} }))

      const sent = JSON.parse(ws.send.mock.calls[0][0])
      expect(sent.error.code).toBe(-32000)
      expect(sent.error.message).toContain('handler failure')
    })
  })

  describe('destroy', () => {
    it('closes the WebSocketServer', () => {
      server.destroy()
      expect(mockWsClose).toHaveBeenCalled()
    })

    it('is idempotent', () => {
      server.destroy()
      server.destroy() // should not throw
    })
  })
})
