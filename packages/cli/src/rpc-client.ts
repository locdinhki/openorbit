import { WebSocket } from 'ws'
import { readFileSync } from 'fs'
import { join, homedir } from 'path'
import { randomUUID } from 'crypto'

export const RPC_PORT = 18790

/**
 * Resolve the rpc-token file path based on platform (mirrors Electron's userData).
 * macOS:   ~/Library/Application Support/openorbit/rpc-token
 * Linux:   ~/.config/openorbit/rpc-token
 * Windows: %APPDATA%/openorbit/rpc-token
 */
export function getTokenPath(): string {
  const home = homedir()
  switch (process.platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'openorbit', 'rpc-token')
    case 'win32':
      return join(
        process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming'),
        'openorbit',
        'rpc-token'
      )
    default:
      return join(process.env['XDG_CONFIG_HOME'] ?? join(home, '.config'), 'openorbit', 'rpc-token')
  }
}

export function readToken(tokenPath?: string): string {
  const path = tokenPath ?? getTokenPath()
  try {
    return readFileSync(path, 'utf-8').trim()
  } catch {
    throw new Error(`Cannot read RPC token from ${path}.\nMake sure OpenOrbit is running.`)
  }
}

type PendingCall = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

/**
 * Minimal JSON-RPC 2.0 WebSocket client.
 * Usage:
 *   const client = new RPCClient({ port: 18790 })
 *   await client.connect()
 *   const result = await client.call('jobs.list', { filters: {} })
 *   client.close()
 */
export class RPCClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, PendingCall>()
  private readonly port: number
  private readonly token: string

  constructor(opts: { token: string; port?: number }) {
    this.token = opts.token
    this.port = opts.port ?? RPC_PORT
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${this.port}`)
      this.ws = ws

      ws.on('open', async () => {
        try {
          await this.call('auth', { token: this.token })
          resolve()
        } catch (err) {
          reject(err)
        }
      })

      ws.on('message', (raw) => {
        let msg: {
          id?: string
          result?: unknown
          error?: { code: number; message: string }
          method?: string
        }
        try {
          msg = JSON.parse(String(raw))
        } catch {
          return
        }

        if (msg.id) {
          const pending = this.pending.get(msg.id)
          if (!pending) return

          this.pending.delete(msg.id)
          if (msg.error) {
            pending.reject(new Error(`RPC error ${msg.error.code}: ${msg.error.message}`))
          } else {
            pending.resolve(msg.result)
          }
        }
        // push notifications are ignored by default (caller can subscribe separately)
      })

      ws.on('error', (err) => reject(err))

      ws.on('close', () => {
        for (const { reject: rej } of this.pending.values()) {
          rej(new Error('Connection closed'))
        }
        this.pending.clear()
      })
    })
  }

  call(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'))
        return
      }

      const id = randomUUID()
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  close(): void {
    this.ws?.close()
    this.ws = null
  }
}
