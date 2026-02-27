// ============================================================================
// OpenOrbit — ext-ai-lm-studio Main Process Entry Point
//
// Registers the LM Studio local LLM provider with the AI Provider Registry.
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { LmStudioProvider } from './lm-studio-provider'

const extension: ExtensionMainAPI = {
  async activate(ctx: ExtensionContext): Promise<void> {
    const provider = new LmStudioProvider(ctx.log)
    ctx.services.ai.registerProvider(provider)
    ctx.log.info('LM Studio local LLM provider registered')
  }
}

export default extension
