// ============================================================================
// ext-imessage — Main Process Entry Point
//
// iMessage bot gateway that receives webhooks from BlueBubbles, routes
// messages through the AI Gateway, and sends responses back via REST API.
// ============================================================================

import { z } from 'zod'
import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { BlueBubblesClient } from './bluebubbles-client'
import { WebhookServer } from './webhook-server'
import { AIGateway } from './ai-gateway'

let server: WebhookServer | null = null
let client: BlueBubblesClient | null = null
let gateway: AIGateway | null = null

const extension: ExtensionMainAPI = {
  async activate(ctx: ExtensionContext): Promise<void> {
    ctx.log.info('ext-imessage: activating')

    // Create AI gateway with direct DB access
    gateway = new AIGateway({ db: ctx.db, log: ctx.log })

    // Register IPC handlers for configuration
    registerIPCHandlers(ctx)

    // Try to start if configured
    const settings = new SettingsRepo()
    const serverUrl = settings.get('imessage.server-url') as string | null
    const password = settings.get('imessage.password') as string | null
    const handlesRaw = settings.get('imessage.authorized-handles') as string | null
    const portRaw = settings.get('imessage.webhook-port') as string | null
    const port = portRaw ? parseInt(portRaw, 10) : 18792

    if (serverUrl && password) {
      const authorizedHandles = handlesRaw
        ? handlesRaw.split(',').map((h) => h.trim()).filter(Boolean)
        : []

      try {
        client = new BlueBubblesClient({ serverUrl, password }, ctx.log)

        const reachable = await client.ping()
        if (reachable) {
          ctx.log.info('ext-imessage: connected to BlueBubbles')
        } else {
          ctx.log.warn('ext-imessage: BlueBubbles server not reachable')
        }

        server = new WebhookServer({ port, password }, ctx.log)

        server.setMessageHandler(async (handle, chatGuid, text) => {
          // Authorization check
          if (authorizedHandles.length > 0 && !authorizedHandles.includes(handle)) {
            ctx.log.warn(`ext-imessage: unauthorized handle ${handle}`)
            return ''
          }

          try {
            await client!.sendTypingIndicator(chatGuid)
          } catch {
            // Non-critical
          }

          const response = await gateway!.handleMessage(text)
          await client!.sendMessage(chatGuid, response)
          return response
        })

        await server.start()
        ctx.log.info(`ext-imessage: webhook server started on port ${port}`)
      } catch (err) {
        ctx.log.error('ext-imessage: failed to start:', err)
        server = null
        client = null
      }
    } else {
      ctx.log.info('ext-imessage: not configured — server not started')
    }
  },

  async deactivate(): Promise<void> {
    server?.stop()
    server = null
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
  ipc.handle('ext-imessage:config-get', z.object({}), () => {
    const settings = new SettingsRepo()
    return {
      serverUrl: settings.get('imessage.server-url') ?? '',
      password: settings.get('imessage.password') ?? '',
      authorizedHandles: settings.get('imessage.authorized-handles') ?? '',
      webhookPort: settings.get('imessage.webhook-port') ?? '18792',
      enabled: server?.isRunning() ?? false
    }
  })

  // Update configuration and restart
  ipc.handle(
    'ext-imessage:config-set',
    z.object({
      'server-url': z.string(),
      password: z.string(),
      'authorized-handles': z.string().optional(),
      'webhook-port': z.string().optional()
    }),
    async (_event, args) => {
      const settings = new SettingsRepo()
      settings.set('imessage.server-url', args['server-url'])
      settings.set('imessage.password', args.password)
      if (args['authorized-handles']) {
        settings.set('imessage.authorized-handles', args['authorized-handles'])
      }
      if (args['webhook-port']) {
        settings.set('imessage.webhook-port', args['webhook-port'])
      }

      // Restart with new config
      server?.stop()
      server = null
      client = null

      if (args['server-url'] && args.password) {
        const port = args['webhook-port'] ? parseInt(args['webhook-port'], 10) : 18792
        const authorizedHandles = args['authorized-handles']
          ? args['authorized-handles'].split(',').map((h) => h.trim()).filter(Boolean)
          : []

        try {
          client = new BlueBubblesClient(
            { serverUrl: args['server-url'], password: args.password },
            ctx.log
          )

          server = new WebhookServer({ port, password: args.password }, ctx.log)

          server.setMessageHandler(async (handle, chatGuid, text) => {
            if (authorizedHandles.length > 0 && !authorizedHandles.includes(handle)) {
              ctx.log.warn(`ext-imessage: unauthorized handle ${handle}`)
              return ''
            }

            try {
              await client!.sendTypingIndicator(chatGuid)
            } catch {
              // Non-critical
            }

            const response = await gateway!.handleMessage(text)
            await client!.sendMessage(chatGuid, response)
            return response
          })

          await server.start()
          return { success: true }
        } catch (err) {
          return { success: false, error: (err as Error).message }
        }
      }

      return { success: true }
    }
  )

  // Get status
  ipc.handle('ext-imessage:status', z.object({}), () => {
    return {
      running: server?.isRunning() ?? false
    }
  })
}

export default extension
