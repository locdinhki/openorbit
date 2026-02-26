// ============================================================================
// OpenOrbit — ext-ai-claude Renderer Entry Point
//
// No renderer-side views in Phase 1. Future phases will add settings UI.
// ============================================================================

import type { ExtensionRendererAPI } from '@openorbit/core/extensions/types'

const extension: ExtensionRendererAPI = {
  activate(): void {
    // No renderer views for Phase 1
  }
}

export default extension
