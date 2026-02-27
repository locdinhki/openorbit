type PendingCall = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

type PushHandler = (event: string, data: unknown) => void

export class RPCClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, PendingCall>()
  private pushHandlers = new Set<PushHandler>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private readonly wsUrl: string
  private readonly token: string
  private _connected = false

  constructor(wsUrl: string, token: string) {
    this.wsUrl = wsUrl
    this.token = token
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl)
      this.ws = ws

      ws.onopen = async (): Promise<void> => {
        try {
          await this.call('auth', { token: this.token })
          this._connected = true
          resolve()
        } catch (err) {
          reject(err)
        }
      }

      ws.onmessage = (event): void => {
        let msg: {
          id?: string
          result?: unknown
          error?: { code: number; message: string }
          method?: string
          params?: Record<string, unknown>
        }
        try {
          msg = JSON.parse(String(event.data))
        } catch {
          return
        }

        // Push notifications (no id, has method)
        if (!msg.id && msg.method === 'push' && msg.params) {
          const pushEvent = msg.params['event'] as string
          const pushData = msg.params['data']
          for (const handler of this.pushHandlers) {
            handler(pushEvent, pushData)
          }
          return
        }

        // RPC responses
        if (msg.id) {
          const p = this.pending.get(msg.id)
          if (!p) return
          this.pending.delete(msg.id)
          clearTimeout(p.timeout)
          if (msg.error) {
            p.reject(new Error(`RPC error ${msg.error.code}: ${msg.error.message}`))
          } else {
            p.resolve(msg.result)
          }
        }
      }

      ws.onerror = (): void => reject(new Error('WebSocket connection failed'))

      ws.onclose = (): void => {
        this._connected = false
        for (const { reject: rej, timeout } of this.pending.values()) {
          clearTimeout(timeout)
          rej(new Error('Connection closed'))
        }
        this.pending.clear()
        this.reconnectTimer = setTimeout(() => this.connect().catch(() => {}), 3000)
      }
    })
  }

  call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'))
        return
      }
      const id = crypto.randomUUID()
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`RPC timeout: ${method}`))
      }, 30_000)
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timeout })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  onPush(handler: PushHandler): () => void {
    this.pushHandlers.add(handler)
    return () => this.pushHandlers.delete(handler)
  }

  close(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
    this.ws = null
    this._connected = false
  }
}
