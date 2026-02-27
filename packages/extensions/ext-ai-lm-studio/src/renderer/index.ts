// ============================================================================
// OpenOrbit — ext-ai-lm-studio Renderer Entry Point
//
// No renderer views — AI providers are main-process only.
// ============================================================================

import type { ExtensionRendererAPI } from '@openorbit/core/extensions/types'

const extension: ExtensionRendererAPI = {
  activate(): void {
    // No renderer views for AI providers
  }
}

export default extension
