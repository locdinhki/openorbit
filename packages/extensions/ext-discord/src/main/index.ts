// ============================================================================
// ext-discord — Main Process Entry Point
//
// Discord bot gateway that connects via discord.js, routes DM messages
// through the AI Gateway, and handles slash commands + button interactions.
// ============================================================================

import { z } from 'zod'
import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { VoiceTranscriber } from '@openorbit/core/audio/voice-transcriber'
import { DiscordClient } from './discord-client'
import { AIGateway } from './ai-gateway'
import { COMMANDS } from './commands'

let client: DiscordClient | null = null
let gateway: AIGateway | null = null

const extension: ExtensionMainAPI = {
  async activate(ctx: ExtensionContext): Promise<void> {
    ctx.log.info('ext-discord: activating')

    // Create AI gateway with direct DB access
    gateway = new AIGateway({ db: ctx.db, log: ctx.log })

    // Register IPC handlers for configuration
    registerIPCHandlers(ctx)

    // Try to start if configured
    const settings = new SettingsRepo()
    const token = settings.get('discord.bot-token') as string | null
    const userIdsRaw = settings.get('discord.authorized-user-ids') as string | null

    if (token) {
      const authorizedUserIds = userIdsRaw
        ? userIdsRaw
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean)
        : []

      try {
        client = new DiscordClient({ token, authorizedUserIds }, ctx.log)

        // Text message handler
        client.setMessageHandler(async (_userId, text) => {
          return gateway!.handleMessage(text)
        })

        // Button interaction handler
        client.setCallbackHandler(async (_userId, data) => {
          return gateway!.processCallback(data)
        })

        // Slash command handler — returns text for simple commands
        client.setSlashCommandHandler(async (_userId, commandName) => {
          const result = await gateway!.tryDirectCommand(`/${commandName}`)
          if (result !== null) return result
          return `Unknown command: /${commandName}`
        })

        // Wire voice transcriber
        const transcriber = new VoiceTranscriber({
          openaiApiKey: settings.get('voice.openai-api-key') as string | undefined
        })
        client.setTranscriber(transcriber)

        await client.start()

        // Register slash commands after login
        await client.registerSlashCommands(COMMANDS)

        ctx.log.info('ext-discord: bot started')
      } catch (err) {
        ctx.log.error('ext-discord: failed to start:', err)
        client = null
      }
    } else {
      ctx.log.info('ext-discord: not configured — bot not started')
    }
  },

  async deactivate(): Promise<void> {
    client?.stop()
    client = null
    gateway = null
  }
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function registerIPCHandlers(ctx: ExtensionContext): void {
  const { ipc } = ctx

  // Get current configuration
  ipc.handle('ext-discord:config-get', z.object({}), () => {
    const settings = new SettingsRepo()
    return {
      botToken: settings.get('discord.bot-token') ?? '',
      authorizedUserIds: settings.get('discord.authorized-user-ids') ?? '',
      connected: client?.isRunning() ?? false
    }
  })

  // Update configuration and restart
  ipc.handle(
    'ext-discord:config-set',
    z.object({
      'bot-token': z.string(),
      'authorized-user-ids': z.string().optional()
    }),
    async (_event, args) => {
      const settings = new SettingsRepo()
      settings.set('discord.bot-token', args['bot-token'])
      if (args['authorized-user-ids'] !== undefined) {
        settings.set('discord.authorized-user-ids', args['authorized-user-ids'])
      }

      // Restart with new config
      client?.stop()
      client = null

      if (args['bot-token']) {
        const authorizedUserIds = args['authorized-user-ids']
          ? args['authorized-user-ids']
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean)
          : []

        try {
          client = new DiscordClient({ token: args['bot-token'], authorizedUserIds }, ctx.log)

          client.setMessageHandler(async (_userId, text) => {
            return gateway!.handleMessage(text)
          })

          client.setCallbackHandler(async (_userId, data) => {
            return gateway!.processCallback(data)
          })

          client.setSlashCommandHandler(async (_userId, commandName) => {
            const result = await gateway!.tryDirectCommand(`/${commandName}`)
            if (result !== null) return result
            return `Unknown command: /${commandName}`
          })

          const settings2 = new SettingsRepo()
          const transcriber = new VoiceTranscriber({
            openaiApiKey: settings2.get('voice.openai-api-key') as string | undefined
          })
          client.setTranscriber(transcriber)

          await client.start()
          await client.registerSlashCommands(COMMANDS)
          return { success: true }
        } catch (err) {
          return { success: false, error: (err as Error).message }
        }
      }

      return { success: true }
    }
  )

  // Get status
  ipc.handle('ext-discord:status', z.object({}), () => {
    return {
      connected: client?.isRunning() ?? false
    }
  })
}

export default extension
