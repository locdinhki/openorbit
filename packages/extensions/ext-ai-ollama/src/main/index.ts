// ============================================================================
// OpenOrbit — ext-ai-ollama Main Process Entry Point
//
// Registers the Ollama local LLM provider with the AI Provider Registry.
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { OllamaProvider } from './ollama-provider'

const extension: ExtensionMainAPI = {
  async activate(ctx: ExtensionContext): Promise<void> {
    const provider = new OllamaProvider(ctx.log)
    ctx.services.ai.registerProvider(provider)
    ctx.log.info('Ollama local LLM provider registered')
  }
}

export default extension
