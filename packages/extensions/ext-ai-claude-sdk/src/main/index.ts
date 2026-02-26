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

    if (provider.isConfigured()) {
      ctx.services.ai.registerProvider(provider)
      ctx.log.info('Claude Agent SDK provider registered (Max plan)')
    } else {
      ctx.log.warn(
        'Claude Agent SDK provider not available — claude CLI not found or not authenticated. ' +
          'Falling back to other providers.'
      )
    }
  }
}

export default extension
