// ============================================================================
// OpenOrbit — iMessage Webhook Server
//
// HTTP server that receives incoming iMessage webhooks from BlueBubbles.
// Runs inside the Electron main process.
// ============================================================================

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import type { Logger } from '@openorbit/core/extensions/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookServerConfig {
  port: number
  password: string
}

export type MessageHandler = (
  handle: string,
  chatGuid: string,
  text: string,
  audioAttachmentGuid?: string
) => Promise<string>

// ---------------------------------------------------------------------------
// WebhookServer
// ---------------------------------------------------------------------------

export class WebhookServer {
  private server: Server | null = null
  private port: number
  private password: string
  private log: Logger
  private running = false
  private onMessage: MessageHandler | null = null

  constructor(config: WebhookServerConfig, log: Logger) {
    this.port = config.port
    this.password = config.password
    this.log = log
  }

  setMessageHandler(handler: MessageHandler): void {
    this.onMessage = handler
  }

  isRunning(): boolean {
    return this.running
  }

  async start(): Promise<void> {
    if (this.running) return

    return new Promise<void>((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((err) => {
          this.log.error('Webhook request error:', err)
          res.writeHead(500)
          res.end('Internal server error')
        })
      })

      this.server.on('error', (err) => {
        this.log.error('Webhook server error:', err)
        reject(err)
      })

      this.server.listen(this.port, () => {
        this.running = true
        this.log.info(`Webhook server listening on port ${this.port}`)
        resolve()
      })
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
    this.running = false
  }

  // -------------------------------------------------------------------------
  // Request handling
  // -------------------------------------------------------------------------

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Only accept POST /webhook/imessage
    if (req.method !== 'POST' || !req.url?.startsWith('/webhook/imessage')) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    // Validate password
    const url = new URL(req.url, `http://localhost:${this.port}`)
    const pw = url.searchParams.get('password')
    if (pw !== this.password) {
      res.writeHead(401)
      res.end('Unauthorized')
      return
    }

    // Parse body
    const body = await parseBody(req)
    if (!body) {
      res.writeHead(400)
      res.end('Bad request')
      return
    }

    // Respond 200 immediately — process async
    res.writeHead(200)
    res.end('OK')

    // Extract message
    const msg = extractMessage(body)
    if (!msg) return

    if (!this.onMessage) return

    try {
      await this.onMessage(msg.handle, msg.chatGuid, msg.text, msg.audioAttachmentGuid)
    } catch (err) {
      this.log.error('Error processing webhook message:', err)
    }
  }
}

// ---------------------------------------------------------------------------
// Payload parsing
// ---------------------------------------------------------------------------

export interface ParsedMessage {
  handle: string
  chatGuid: string
  text: string
  audioAttachmentGuid?: string
}

export function extractMessage(payload: unknown): ParsedMessage | null {
  // BlueBubbles webhook payload structure — dynamic shape from external API
  const p = payload as Record<string, Record<string, unknown>> | null | undefined
  const data = p?.data
  if (!data) return null

  // Skip messages from self
  if (data.isFromMe) return null

  // Skip group messages
  if (data.isGroup) return null

  // Extract sender handle
  const handle = (data.handle as Record<string, string> | undefined)?.address
  if (!handle) return null

  // Extract chat GUID from first chat
  const chats = data.chats as Array<Record<string, string>> | undefined
  const chatGuid = chats?.[0]?.guid
  if (!chatGuid) return null

  // Check for text content
  const text = (data.text as string | undefined)?.trim()
  if (text) {
    return { handle, chatGuid, text }
  }

  // Check for audio attachment when no text
  const attachments = data.attachments as Array<Record<string, string>> | undefined
  const attachment = attachments?.[0]
  if (attachment?.mimeType?.startsWith('audio/') && attachment.guid) {
    return { handle, chatGuid, text: '', audioAttachmentGuid: attachment.guid }
  }

  return null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString()
        resolve(JSON.parse(body))
      } catch {
        resolve(null)
      }
    })

    req.on('error', () => {
      resolve(null)
    })
  })
}
