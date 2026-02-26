// ============================================================================
// ext-whatsapp — Main Process Entry Point
//
// WhatsApp bot gateway that connects via Baileys WebSocket, routes
// messages through the AI Gateway, and sends responses back.
// ============================================================================

import { z } from 'zod'
import { join } from 'path'
import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { VoiceTranscriber } from '@openorbit/core/audio/voice-transcriber'
import { WhatsAppClient } from './whatsapp-client'
import { AIGateway } from './ai-gateway'

let client: WhatsAppClient | null = null
let gateway: AIGateway | null = null

const extension: ExtensionMainAPI = {
  async activate(ctx: ExtensionContext): Promise<void> {
    ctx.log.info('ext-whatsapp: activating')

    // Create AI gateway with direct DB access
    gateway = new AIGateway({ db: ctx.db, log: ctx.log })

    // Register IPC handlers for configuration
    registerIPCHandlers(ctx)

    // Try to start if configured
    const settings = new SettingsRepo()
    const numbersRaw = settings.get('whatsapp.authorized-numbers') as string | null
    const dataDir =
      (settings.get('whatsapp.data-dir') as string | null) ?? join(ctx.storagePath, 'whatsapp-auth')

    const authorizedNumbers = numbersRaw
      ? numbersRaw
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
      : []

    try {
      client = new WhatsAppClient({ authorizedNumbers, dataDir }, ctx.log)

      client.setMessageHandler(async (from, text) => {
        return gateway!.handleMessage(text)
      })

      client.setQRHandler((qr) => {
        ctx.ipc.send('ext-whatsapp:qr-code', { qr })
      })

      // Wire voice transcriber
      const transcriber = new VoiceTranscriber({
        openaiApiKey: settings.get('voice.openai-api-key') as string | undefined
      })
      client.setTranscriber(transcriber)

      await client.start()
      ctx.log.info('ext-whatsapp: client started')
    } catch (err) {
      ctx.log.error('ext-whatsapp: failed to start:', err)
      client = null
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
  ipc.handle('ext-whatsapp:config-get', z.object({}), () => {
    const settings = new SettingsRepo()
    return {
      authorizedNumbers: settings.get('whatsapp.authorized-numbers') ?? '',
      dataDir: settings.get('whatsapp.data-dir') ?? '',
      connected: client?.isRunning() ?? false
    }
  })

  // Update configuration and restart
  ipc.handle(
    'ext-whatsapp:config-set',
    z.object({
      'authorized-numbers': z.string().optional(),
      'data-dir': z.string().optional()
    }),
    async (_event, args) => {
      const settings = new SettingsRepo()
      if (args['authorized-numbers'] !== undefined) {
        settings.set('whatsapp.authorized-numbers', args['authorized-numbers'])
      }
      if (args['data-dir']) {
        settings.set('whatsapp.data-dir', args['data-dir'])
      }

      // Restart with new config
      client?.stop()
      client = null

      const numbersRaw = settings.get('whatsapp.authorized-numbers') as string | null
      const dataDir =
        (settings.get('whatsapp.data-dir') as string | null) ??
        join(ctx.storagePath, 'whatsapp-auth')

      const authorizedNumbers = numbersRaw
        ? numbersRaw
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
        : []

      try {
        client = new WhatsAppClient({ authorizedNumbers, dataDir }, ctx.log)

        client.setMessageHandler(async (from, text) => {
          return gateway!.handleMessage(text)
        })

        client.setQRHandler((qr) => {
          ctx.ipc.send('ext-whatsapp:qr-code', { qr })
        })

        const settings2 = new SettingsRepo()
        const transcriber = new VoiceTranscriber({
          openaiApiKey: settings2.get('voice.openai-api-key') as string | undefined
        })
        client.setTranscriber(transcriber)

        await client.start()
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // Get status
  ipc.handle('ext-whatsapp:status', z.object({}), () => {
    return {
      connected: client?.isRunning() ?? false
    }
  })
}

export default extension
