// ============================================================================
// OpenOrbit — Telegram Bot Client
//
// Long-polling Telegram Bot API client. Receives messages, routes them through
// the AI Gateway, and sends formatted responses back.
// ============================================================================

import type { Logger } from '@openorbit/core/extensions/types'
import type { VoiceTranscriber } from '@openorbit/core/audio/voice-transcriber'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TelegramMessage {
  message_id: number
  chat: { id: number; first_name?: string; username?: string }
  text?: string
  voice?: { file_id: string; duration: number }
  audio?: { file_id: string; duration: number }
  date: number
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  callback_query?: {
    id: string
    message?: TelegramMessage
    data?: string
    from: { id: number }
  }
}

export interface TelegramBotConfig {
  token: string
  authorizedChatIds: number[]
}

export interface InlineKeyboardButton {
  text: string
  callback_data: string
}

export interface SendMessageOptions {
  parse_mode?: 'Markdown' | 'MarkdownV2' | 'HTML'
  reply_markup?: {
    inline_keyboard: InlineKeyboardButton[][]
  }
}

type MessageHandler = (chatId: number, text: string) => Promise<string>
type CallbackHandler = (chatId: number, callbackId: string, data: string) => Promise<string>

// ---------------------------------------------------------------------------
// TelegramBot
// ---------------------------------------------------------------------------

export class TelegramBot {
  private token: string
  private authorizedChatIds: Set<number>
  private log: Logger
  private running = false
  private offset = 0
  private abortController: AbortController | null = null
  private onMessage: MessageHandler | null = null
  private onCallback: CallbackHandler | null = null
  private transcriber: VoiceTranscriber | null = null

  constructor(config: TelegramBotConfig, log: Logger) {
    this.token = config.token
    this.authorizedChatIds = new Set(config.authorizedChatIds)
    this.log = log
  }

  setTranscriber(transcriber: VoiceTranscriber): void {
    this.transcriber = transcriber
  }

  setMessageHandler(handler: MessageHandler): void {
    this.onMessage = handler
  }

  setCallbackHandler(handler: CallbackHandler): void {
    this.onCallback = handler
  }

  isRunning(): boolean {
    return this.running
  }

  async start(): Promise<void> {
    if (this.running) return

    // Verify token by calling getMe
    const me = (await this.apiCall('getMe')) as { username: string }
    this.log.info(`Telegram bot started as @${me.username}`)
    this.running = true
    this.poll()
  }

  stop(): void {
    this.running = false
    this.abortController?.abort()
    this.abortController = null
    this.log.info('Telegram bot stopped')
  }

  async sendMessage(chatId: number, text: string, options?: SendMessageOptions): Promise<void> {
    await this.apiCall('sendMessage', {
      chat_id: chatId,
      text: truncateMessage(text),
      parse_mode: options?.parse_mode ?? 'Markdown',
      ...(options?.reply_markup ? { reply_markup: options.reply_markup } : {})
    })
  }

  async answerCallbackQuery(callbackId: string, text?: string): Promise<void> {
    await this.apiCall('answerCallbackQuery', {
      callback_query_id: callbackId,
      ...(text ? { text } : {})
    })
  }

  // -------------------------------------------------------------------------
  // Long polling
  // -------------------------------------------------------------------------

  private async poll(): Promise<void> {
    while (this.running) {
      try {
        this.abortController = new AbortController()
        const updates = (await this.apiCall('getUpdates', {
          offset: this.offset,
          timeout: 30,
          allowed_updates: ['message', 'callback_query']
        })) as TelegramUpdate[]

        for (const update of updates) {
          this.offset = update.update_id + 1
          this.processUpdate(update).catch((err) => {
            this.log.error('Error processing Telegram update:', err)
          })
        }
      } catch (err) {
        if (!this.running) break
        this.log.error('Telegram polling error:', err)
        // Wait before retrying
        await sleep(5000)
      }
    }
  }

  private async processUpdate(update: TelegramUpdate): Promise<void> {
    // Handle text messages
    if (update.message?.text) {
      const chatId = update.message.chat.id
      if (!this.isAuthorized(chatId)) {
        this.log.warn(`Unauthorized message from chat ${chatId}`)
        return
      }

      if (!this.onMessage) return

      try {
        await this.apiCall('sendChatAction', { chat_id: chatId, action: 'typing' })
        const response = await this.onMessage(chatId, update.message.text)
        await this.sendMessage(chatId, response)
      } catch (err) {
        this.log.error('Error handling message:', err)
        await this.sendMessage(chatId, 'Sorry, something went wrong processing your message.')
      }
    }

    // Handle voice/audio messages
    const voiceFileId = update.message?.voice?.file_id ?? update.message?.audio?.file_id
    if (voiceFileId && update.message && !update.message.text) {
      const chatId = update.message.chat.id
      if (!this.isAuthorized(chatId)) return
      if (!this.onMessage) return

      if (!this.transcriber) {
        await this.sendMessage(
          chatId,
          'Voice messages are not supported. Please send text instead.'
        )
        return
      }

      try {
        await this.apiCall('sendChatAction', { chat_id: chatId, action: 'typing' })
        const audioPath = await this.downloadFile(voiceFileId)
        const { transcript } = await this.transcriber.transcribe(audioPath)
        cleanupFile(audioPath)

        if (!transcript.trim()) {
          await this.sendMessage(
            chatId,
            'Could not transcribe the voice message. Please try again.'
          )
          return
        }

        const response = await this.onMessage(chatId, transcript)
        await this.sendMessage(chatId, response)
      } catch (err) {
        this.log.error('Error handling voice message:', err)
        await this.sendMessage(chatId, 'Sorry, something went wrong processing your voice message.')
      }
    }

    // Handle callback queries (inline keyboard button presses)
    if (update.callback_query) {
      const cb = update.callback_query
      const chatId = cb.from.id
      if (!this.isAuthorized(chatId)) return
      if (!this.onCallback || !cb.data) return

      try {
        const response = await this.onCallback(chatId, cb.id, cb.data)
        await this.answerCallbackQuery(cb.id)
        await this.sendMessage(chatId, response)
      } catch (err) {
        this.log.error('Error handling callback:', err)
        await this.answerCallbackQuery(cb.id, 'Error processing action')
      }
    }
  }

  private isAuthorized(chatId: number): boolean {
    // If no authorized IDs configured, allow all (for initial setup)
    if (this.authorizedChatIds.size === 0) return true
    return this.authorizedChatIds.has(chatId)
  }

  // -------------------------------------------------------------------------
  // File download (for voice messages)
  // -------------------------------------------------------------------------

  private async downloadFile(fileId: string): Promise<string> {
    const fileInfo = (await this.apiCall('getFile', { file_id: fileId })) as { file_path: string }
    const filePath = fileInfo.file_path
    const url = `https://api.telegram.org/file/bot${this.token}/${filePath}`

    const response = await fetch(url, { signal: this.abortController?.signal })
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const { join } = await import('path')
    const { tmpdir } = await import('os')
    const { writeFileSync } = await import('fs')
    const { randomUUID } = await import('crypto')

    const ext = filePath.includes('.') ? filePath.slice(filePath.lastIndexOf('.')) : '.ogg'
    const tmpPath = join(tmpdir(), `tg-voice-${randomUUID()}${ext}`)
    writeFileSync(tmpPath, buffer)
    return tmpPath
  }

  // -------------------------------------------------------------------------
  // API helpers
  // -------------------------------------------------------------------------

  private async apiCall(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const url = `https://api.telegram.org/bot${this.token}/${method}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
      signal: this.abortController?.signal
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Telegram API error ${response.status}: ${text}`)
    }

    const data = await response.json()
    if (!data.ok) {
      throw new Error(`Telegram API returned error: ${data.description}`)
    }

    return data.result
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Telegram messages are limited to 4096 characters. */
function truncateMessage(text: string): string {
  if (text.length <= 4096) return text
  return text.slice(0, 4080) + '\n\n_(truncated)_'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function cleanupFile(filePath: string): void {
  try {
    const { unlinkSync } = require('fs') as typeof import('fs') // eslint-disable-line @typescript-eslint/no-require-imports
    unlinkSync(filePath)
  } catch {
    // Best-effort cleanup
  }
}
