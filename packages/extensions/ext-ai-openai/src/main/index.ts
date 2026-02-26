// ============================================================================
// OpenOrbit — ext-ai-openai Main Process Entry Point
//
// Registers the OpenAI provider with the shell's AI Provider Registry.
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { OpenAIProvider } from './openai-provider'

const extension: ExtensionMainAPI = {
  async activate(ctx: ExtensionContext): Promise<void> {
    const provider = new OpenAIProvider(ctx.log)
    ctx.services.ai.registerProvider(provider)
    ctx.log.info('OpenAI provider registered')
  }
}

export default extension
