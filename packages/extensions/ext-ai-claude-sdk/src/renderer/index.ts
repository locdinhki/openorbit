// ============================================================================
// OpenOrbit — ext-ai-claude-sdk Renderer Entry Point
//
// No renderer-side views. AI provider is main-process only.
// ============================================================================

import type { ExtensionRendererAPI } from '@openorbit/core/extensions/types'

const extension: ExtensionRendererAPI = {
  activate(): void {
    // No renderer views
  }
}

export default extension
