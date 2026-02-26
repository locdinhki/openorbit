// ============================================================================
// OpenOrbit MCP Server — RPC Bridge
//
// WebSocket client that connects to the OpenOrbit RPC server. Reuses the
// same JSON-RPC 2.0 protocol as the CLI and mobile companion.
// ============================================================================

import { WebSocket } from 'ws'
import { readFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'

export const DEFAULT_PORT = 18790

type PendingCall = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
}

/** Resolve the rpc-token file path based on platform. */
function getTokenPath(): string {
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
    throw new Error(
      `Cannot read RPC token from ${path}.\n` + 'Make sure OpenOrbit desktop app is running.'
    )
  }
}

/**
 * JSON-RPC 2.0 WebSocket client for bridging MCP tools to OpenOrbit.
 */
export class RPCBridge {
  private ws: WebSocket | null = null
  private pending = new Map<string, PendingCall>()
  private readonly host: string
  private readonly port: number
  private readonly token: string

  constructor(opts: { token: string; host?: string; port?: number }) {
    this.token = opts.token
    this.host = opts.host ?? '127.0.0.1'
    this.port = opts.port ?? DEFAULT_PORT
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${this.host}:${this.port}`)
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
        reject(new Error('Not connected to OpenOrbit RPC server'))
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

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}
