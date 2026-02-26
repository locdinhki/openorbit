// ============================================================================
// ext-telegram — Main Process Entry Point
//
// Telegram bot gateway that routes messages through the Claude Agent SDK
// with in-process access to OpenOrbit data.
// ============================================================================

import { z } from 'zod'
import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { VoiceTranscriber } from '@openorbit/core/audio/voice-transcriber'
import { TelegramBot } from './telegram-bot'
import { AIGateway } from './ai-gateway'

let bot: TelegramBot | null = null
let gateway: AIGateway | null = null

const extension: ExtensionMainAPI = {
  async activate(ctx: ExtensionContext): Promise<void> {
    ctx.log.info('ext-telegram: activating')

    // Create AI gateway with direct DB access
    gateway = new AIGateway({ db: ctx.db, log: ctx.log })

    // Register IPC handlers for configuration
    registerIPCHandlers(ctx)

    // Try to start bot if configured
    const settings = new SettingsRepo()
    const token = settings.get('telegram.bot-token') as string | null
    const chatIdsRaw = settings.get('telegram.authorized-chat-ids') as string | null

    if (token) {
      const chatIds = chatIdsRaw
        ? chatIdsRaw
            .split(',')
            .map((id) => parseInt(id.trim(), 10))
            .filter((id) => !isNaN(id))
        : []

      try {
        bot = new TelegramBot({ token, authorizedChatIds: chatIds }, ctx.log)

        bot.setMessageHandler(async (_chatId, text) => {
          return gateway!.handleMessage(text)
        })

        bot.setCallbackHandler(async (_chatId, _callbackId, data) => {
          return gateway!.processCallback(data)
        })

        // Wire voice transcriber
        const transcriber = new VoiceTranscriber({
          openaiApiKey: settings.get('voice.openai-api-key') as string | undefined
        })
        bot.setTranscriber(transcriber)

        await bot.start()
        ctx.log.info('ext-telegram: bot started')
      } catch (err) {
        ctx.log.error('ext-telegram: failed to start bot:', err)
        bot = null
      }
    } else {
      ctx.log.info('ext-telegram: no bot token configured — bot not started')
    }
  },

  async deactivate(): Promise<void> {
    bot?.stop()
    bot = null
    gateway = null
  }
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function registerIPCHandlers(ctx: ExtensionContext): void {
  const { ipc } = ctx

  // Get current configuration
  ipc.handle('ext-telegram:config-get', z.object({}), () => {
    const settings = new SettingsRepo()
    return {
      token: settings.get('telegram.bot-token') ?? '',
      authorizedChatIds: settings.get('telegram.authorized-chat-ids') ?? '',
      enabled: bot?.isRunning() ?? false
    }
  })

  // Update configuration and restart bot
  ipc.handle(
    'ext-telegram:config-set',
    z.object({
      token: z.string(),
      'authorized-chat-ids': z.string().optional()
    }),
    async (_event, args) => {
      const settings = new SettingsRepo()
      settings.set('telegram.bot-token', args.token)
      if (args['authorized-chat-ids']) {
        settings.set('telegram.authorized-chat-ids', args['authorized-chat-ids'])
      }

      // Restart bot with new config
      bot?.stop()
      bot = null

      if (args.token) {
        const chatIds = args['authorized-chat-ids']
          ? args['authorized-chat-ids']
              .split(',')
              .map((id) => parseInt(id.trim(), 10))
              .filter((id) => !isNaN(id))
          : []

        try {
          bot = new TelegramBot({ token: args.token, authorizedChatIds: chatIds }, ctx.log)

          bot.setMessageHandler(async (_chatId, text) => {
            return gateway!.handleMessage(text)
          })

          bot.setCallbackHandler(async (_chatId, _callbackId, data) => {
            return gateway!.processCallback(data)
          })

          const settings2 = new SettingsRepo()
          const transcriber = new VoiceTranscriber({
            openaiApiKey: settings2.get('voice.openai-api-key') as string | undefined
          })
          bot.setTranscriber(transcriber)

          await bot.start()
          return { success: true }
        } catch (err) {
          return { success: false, error: (err as Error).message }
        }
      }

      return { success: true }
    }
  )

  // Get bot status
  ipc.handle('ext-telegram:status', z.object({}), () => {
    return {
      running: bot?.isRunning() ?? false
    }
  })
}

export default extension
