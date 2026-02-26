// ============================================================================
// OpenOrbit — ext-ai-claude Main Process Entry Point
//
// Registers the Claude AI provider with the shell's AI Provider Registry.
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { ClaudeProvider } from './claude-provider'

const extension: ExtensionMainAPI = {
  async activate(ctx: ExtensionContext): Promise<void> {
    const provider = new ClaudeProvider(ctx.log)
    ctx.services.ai.registerProvider(provider)
    ctx.log.info('Claude AI provider registered')
  }
}

export default extension
