// ============================================================================
// OpenOrbit — ext-ai-claude-sdk Main Process Entry Point
//
// Registers the Claude Agent SDK provider with the shell's AI Provider Registry.
// Uses the Max plan subscription — no API key required.
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { ClaudeSdkProvider } from './claude-sdk-provider'

const extension: ExtensionMainAPI = {
  async activate(ctx: ExtensionContext): Promise<void> {
    const provider = new ClaudeSdkProvider(ctx.log)

    if (!provider.isConfigured()) {
      throw new Error(
        'Claude CLI not found or not authenticated. Install the claude CLI and run "claude login" first.'
      )
    }

    // Verify the subscription actually works with a real API call
    ctx.log.info('Testing Claude Max Plan connection...')
    const model = await provider.testConnection()
    ctx.log.info(`Connection verified — model: ${model}`)

    ctx.services.ai.registerProvider(provider)
    ctx.log.info('Claude Agent SDK provider registered (Max plan)')
  }
}

export default extension
