// ============================================================================
// ext-telegram — TelegramBot Tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TelegramBot, type TelegramBotConfig, type TelegramUpdate } from '../telegram-bot'

/** Helper type to access private members in tests. */
type BotInternals = {
  abortController: AbortController
  processUpdate(update: TelegramUpdate): Promise<void>
}

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeConfig(overrides?: Partial<TelegramBotConfig>): TelegramBotConfig {
  return {
    token: 'test-token-123',
    authorizedChatIds: [12345],
    ...overrides
  }
}

const mockLog = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

describe('TelegramBot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates bot with config', () => {
    const bot = new TelegramBot(makeConfig(), mockLog)
    expect(bot.isRunning()).toBe(false)
  })

  it('starts by calling getMe', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { username: 'test_bot' } })
    })

    const bot = new TelegramBot(makeConfig(), mockLog)

    // Mock getUpdates to return empty and then stop
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: [] })
    })

    await bot.start()
    expect(bot.isRunning()).toBe(true)

    // Verify getMe was called
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token-123/getMe',
      expect.objectContaining({ method: 'POST' })
    )

    bot.stop()
    expect(bot.isRunning()).toBe(false)
  })

  it('throws on invalid token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized')
    })

    const bot = new TelegramBot(makeConfig(), mockLog)
    await expect(bot.start()).rejects.toThrow('Telegram API error 401')
  })

  it('sends message with markdown', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 1 } })
    })

    const bot = new TelegramBot(makeConfig(), mockLog)
    // Manually set abort controller for sendMessage
    ;(bot as unknown as BotInternals).abortController = new AbortController()

    await bot.sendMessage(12345, 'Hello *world*')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token-123/sendMessage',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          chat_id: 12345,
          text: 'Hello *world*',
          parse_mode: 'Markdown'
        })
      })
    )
  })

  it('truncates long messages', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 1 } })
    })

    const bot = new TelegramBot(makeConfig(), mockLog)
    ;(bot as unknown as BotInternals).abortController = new AbortController()

    const longMessage = 'x'.repeat(5000)
    await bot.sendMessage(12345, longMessage)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.text.length).toBeLessThanOrEqual(4096)
    expect(body.text).toContain('_(truncated)_')
  })

  it('rejects unauthorized messages', async () => {
    // Start bot
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { username: 'test_bot' } })
    })

    const bot = new TelegramBot(makeConfig({ authorizedChatIds: [12345] }), mockLog)
    const handler = vi.fn().mockResolvedValue('response')
    bot.setMessageHandler(handler)

    // Process an update from unauthorized user
    ;(bot as unknown as BotInternals).processUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 99999 },
        text: 'hello',
        date: Date.now()
      }
    })

    // Handler should NOT be called
    expect(handler).not.toHaveBeenCalled()
    expect(mockLog.warn).toHaveBeenCalledWith('Unauthorized message from chat 99999')
  })

  it('allows all when no authorized IDs configured', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: { message_id: 1 } })
    })

    const bot = new TelegramBot(makeConfig({ authorizedChatIds: [] }), mockLog)
    const handler = vi.fn().mockResolvedValue('response')
    bot.setMessageHandler(handler)
    ;(bot as unknown as BotInternals).abortController = new AbortController()
    await (bot as unknown as BotInternals).processUpdate({
      update_id: 1,
      message: {
        message_id: 1,
        chat: { id: 99999 },
        text: 'hello',
        date: Date.now()
      }
    })

    expect(handler).toHaveBeenCalledWith(99999, 'hello')
  })

  it('handles callback queries', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, result: true })
    })

    const bot = new TelegramBot(makeConfig({ authorizedChatIds: [] }), mockLog)
    const callbackHandler = vi.fn().mockResolvedValue('Job approved!')
    bot.setCallbackHandler(callbackHandler)
    ;(bot as unknown as BotInternals).abortController = new AbortController()
    await (bot as unknown as BotInternals).processUpdate({
      update_id: 2,
      callback_query: {
        id: 'cb-123',
        data: 'approve:job-1',
        from: { id: 12345 },
        message: { message_id: 1, chat: { id: 12345 }, date: Date.now() }
      }
    })

    expect(callbackHandler).toHaveBeenCalledWith(12345, 'cb-123', 'approve:job-1')
  })

  // -------------------------------------------------------------------------
  // Voice message handling
  // -------------------------------------------------------------------------

  describe('voice messages', () => {
    it('replies with hint when no transcriber set', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: { message_id: 1 } })
      })

      const bot = new TelegramBot(makeConfig({ authorizedChatIds: [] }), mockLog)
      const handler = vi.fn().mockResolvedValue('response')
      bot.setMessageHandler(handler)
      ;(bot as unknown as BotInternals).abortController = new AbortController()
      await (bot as unknown as BotInternals).processUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345 },
          voice: { file_id: 'voice-123', duration: 5 },
          date: Date.now()
        }
      })

      // Handler should NOT be called — voice not supported
      expect(handler).not.toHaveBeenCalled()
      // Should have sent "not supported" message
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/sendMessage'),
        expect.objectContaining({
          body: expect.stringContaining('not supported')
        })
      )
    })

    it('transcribes voice and forwards to message handler', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ ok: true, result: { file_path: 'voice/file.ogg', message_id: 1 } }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      })

      const bot = new TelegramBot(makeConfig({ authorizedChatIds: [] }), mockLog)
      const handler = vi.fn().mockResolvedValue('Got your voice!')
      bot.setMessageHandler(handler)

      const mockTranscriber = {
        transcribe: vi.fn().mockResolvedValue({
          transcript: 'Hello from voice',
          durationSeconds: 2.5,
          model: 'whisper-tiny'
        }),
        isAvailable: vi.fn().mockResolvedValue(true),
        isEnabled: vi.fn().mockResolvedValue(true)
      }
      bot.setTranscriber(
        mockTranscriber as unknown as import('@openorbit/core/audio/voice-transcriber').VoiceTranscriber
      )
      ;(bot as unknown as BotInternals).abortController = new AbortController()
      await (bot as unknown as BotInternals).processUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345 },
          voice: { file_id: 'voice-123', duration: 5 },
          date: Date.now()
        }
      })

      expect(handler).toHaveBeenCalledWith(12345, 'Hello from voice')
    })

    it('handles audio messages same as voice', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ ok: true, result: { file_path: 'audio/file.mp3', message_id: 1 } }),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
      })

      const bot = new TelegramBot(makeConfig({ authorizedChatIds: [] }), mockLog)
      const handler = vi.fn().mockResolvedValue('Got your audio!')
      bot.setMessageHandler(handler)

      const mockTranscriber = {
        transcribe: vi.fn().mockResolvedValue({
          transcript: 'Audio content',
          durationSeconds: 10,
          model: 'whisper-tiny'
        }),
        isAvailable: vi.fn().mockResolvedValue(true),
        isEnabled: vi.fn().mockResolvedValue(true)
      }
      bot.setTranscriber(
        mockTranscriber as unknown as import('@openorbit/core/audio/voice-transcriber').VoiceTranscriber
      )
      ;(bot as unknown as BotInternals).abortController = new AbortController()
      await (bot as unknown as BotInternals).processUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345 },
          audio: { file_id: 'audio-456', duration: 10 },
          date: Date.now()
        }
      })

      expect(handler).toHaveBeenCalledWith(12345, 'Audio content')
    })

    it('skips voice handling when text is also present', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ok: true, result: { message_id: 1 } })
      })

      const bot = new TelegramBot(makeConfig({ authorizedChatIds: [] }), mockLog)
      const handler = vi.fn().mockResolvedValue('response')
      bot.setMessageHandler(handler)

      const mockTranscriber = {
        transcribe: vi.fn(),
        isAvailable: vi.fn().mockResolvedValue(true),
        isEnabled: vi.fn().mockResolvedValue(true)
      }
      bot.setTranscriber(
        mockTranscriber as unknown as import('@openorbit/core/audio/voice-transcriber').VoiceTranscriber
      )
      ;(bot as unknown as BotInternals).abortController = new AbortController()
      await (bot as unknown as BotInternals).processUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 12345 },
          text: 'caption text',
          voice: { file_id: 'voice-123', duration: 5 },
          date: Date.now()
        }
      })

      // Text handler should be used, not transcriber
      expect(handler).toHaveBeenCalledWith(12345, 'caption text')
      expect(mockTranscriber.transcribe).not.toHaveBeenCalled()
    })
  })
})
