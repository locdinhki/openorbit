// ============================================================================
// OpenOrbit — WhatsApp Client (Baileys Wrapper)
//
// Event-driven WhatsApp Web client using Baileys. Handles QR pairing,
// credential persistence, message routing, and authorization.
// ============================================================================

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  isJidUser,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} from '@whiskeysockets/baileys'
import type { Logger } from '@openorbit/core/extensions/types'
import type { VoiceTranscriber } from '@openorbit/core/audio/voice-transcriber'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WhatsAppConfig {
  authorizedNumbers: string[] // E.164 format, empty = allow all
  dataDir: string // credential storage path
}

export type MessageHandler = (from: string, text: string) => Promise<string>
export type QRHandler = (qr: string) => void

// ---------------------------------------------------------------------------
// WhatsAppClient
// ---------------------------------------------------------------------------

export class WhatsAppClient {
  private socket: ReturnType<typeof makeWASocket> | null = null
  private running = false
  private authorizedNumbers: Set<string>
  private dataDir: string
  private log: Logger
  private onMessage: MessageHandler | null = null
  private onQR: QRHandler | null = null
  private reconnectAttempt = 0
  private maxReconnectDelay = 60_000
  private transcriber: VoiceTranscriber | null = null

  constructor(config: WhatsAppConfig, log: Logger) {
    this.dataDir = config.dataDir
    this.log = log
    // Normalize numbers: strip leading + for consistent comparison
    this.authorizedNumbers = new Set(config.authorizedNumbers.map((n) => n.replace(/^\+/, '')))
  }

  setMessageHandler(handler: MessageHandler): void {
    this.onMessage = handler
  }

  setQRHandler(handler: QRHandler): void {
    this.onQR = handler
  }

  setTranscriber(transcriber: VoiceTranscriber): void {
    this.transcriber = transcriber
  }

  isRunning(): boolean {
    return this.running
  }

  isAuthorized(phone: string): boolean {
    if (this.authorizedNumbers.size === 0) return true
    const normalized = phone.replace(/^\+/, '')
    return this.authorizedNumbers.has(normalized)
  }

  async start(): Promise<void> {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- not a React hook, Baileys function
    const { state, saveCreds } = await useMultiFileAuthState(this.dataDir)
    const { version } = await fetchLatestBaileysVersion()

    this.socket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: silentLogger()
    })

    this.socket.ev.on('creds.update', saveCreds)

    this.socket.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        this.log.info('WhatsApp QR code received')
        this.onQR?.(qr)
      }

      if (connection === 'open') {
        this.running = true
        this.reconnectAttempt = 0
        this.log.info('WhatsApp connected')
      }

      if (connection === 'close') {
        this.running = false
        const statusCode = (
          lastDisconnect?.error as unknown as { output?: { statusCode?: number } }
        )?.output?.statusCode
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut

        if (shouldReconnect) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay)
          this.reconnectAttempt++
          this.log.info(`WhatsApp disconnected, reconnecting in ${delay}ms...`)
          setTimeout(() => this.start(), delay)
        } else {
          this.log.info('WhatsApp logged out — not reconnecting')
        }
      }
    })

    this.socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return

      for (const msg of messages) {
        // Self-chat protection
        if (msg.key.fromMe) continue

        // DM-only: skip group JIDs
        const remoteJid = msg.key.remoteJid
        if (!remoteJid || !isJidUser(remoteJid)) continue

        // Extract text
        const text = msg.message?.conversation ?? msg.message?.extendedTextMessage?.text

        // Extract phone number from JID
        const phone = remoteJid.replace('@s.whatsapp.net', '')

        // Authorization check
        if (!this.isAuthorized(phone)) {
          this.log.warn(`Unauthorized WhatsApp message from ${phone}`)
          continue
        }

        if (!this.onMessage) continue

        // Handle audio/voice messages
        if (!text && msg.message?.audioMessage) {
          if (!this.transcriber) {
            await this.sendMessage(
              remoteJid,
              'Voice messages are not supported. Please send text instead.'
            )
            continue
          }

          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', {})
            const audioPath = await writeTempAudio(buffer as Buffer, 'ogg')
            const { transcript } = await this.transcriber.transcribe(audioPath)
            cleanupFile(audioPath)

            if (!transcript.trim()) {
              await this.sendMessage(
                remoteJid,
                'Could not transcribe the voice message. Please try again.'
              )
              continue
            }

            const response = await this.onMessage(phone, transcript)
            if (response) {
              await this.sendMessage(remoteJid, response)
            }
            await this.socket!.readMessages([msg.key])
          } catch (err) {
            this.log.error('Error processing WhatsApp voice message:', err)
          }
          continue
        }

        if (!text) continue

        try {
          const response = await this.onMessage(phone, text)
          if (response) {
            await this.sendMessage(remoteJid, response)
          }
          // Mark as read
          await this.socket!.readMessages([msg.key])
        } catch (err) {
          this.log.error('Error processing WhatsApp message:', err)
        }
      }
    })
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.socket) throw new Error('WhatsApp not connected')

    const chunks = chunkMessage(text, 4000)
    for (const chunk of chunks) {
      await this.socket.sendMessage(jid, { text: chunk })
    }
  }

  stop(): void {
    if (this.socket) {
      this.socket.end(undefined)
      this.socket = null
    }
    this.running = false
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split text into chunks at paragraph boundaries. */
export function chunkMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }

    // Try to split at paragraph boundary
    const splitIdx = remaining.lastIndexOf('\n\n', maxLen)
    if (splitIdx > maxLen / 2) {
      chunks.push(remaining.slice(0, splitIdx))
      remaining = remaining.slice(splitIdx + 2)
    } else {
      // Hard split at maxLen
      chunks.push(remaining.slice(0, maxLen))
      remaining = remaining.slice(maxLen)
    }
  }

  return chunks
}

async function writeTempAudio(buffer: Buffer, ext: string): Promise<string> {
  const { join } = await import('path')
  const { tmpdir } = await import('os')
  const { writeFileSync } = await import('fs')
  const { randomUUID } = await import('crypto')

  const tmpPath = join(tmpdir(), `wa-voice-${randomUUID()}.${ext}`)
  writeFileSync(tmpPath, buffer)
  return tmpPath
}

function cleanupFile(filePath: string): void {
  try {
    const { unlinkSync } = require('fs') as typeof import('fs') // eslint-disable-line @typescript-eslint/no-require-imports
    unlinkSync(filePath)
  } catch {
    // Best-effort cleanup
  }
}

/** Create a silent logger to suppress Baileys' verbose pino output. */
function silentLogger(): unknown {
  const noop = (): unknown => silentLoggerInstance
  const silentLoggerInstance = {
    level: 'silent',
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    child: () => silentLoggerInstance
  }
  return silentLoggerInstance
}
