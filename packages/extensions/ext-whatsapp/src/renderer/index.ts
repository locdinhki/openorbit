// ============================================================================
// OpenOrbit — ext-whatsapp Renderer Entry Point
//
// No renderer-side views for the WhatsApp bot extension.
// Configuration is done via IPC from the settings page.
// ============================================================================

import type { ExtensionRendererAPI } from '@openorbit/core/extensions/types'

const extension: ExtensionRendererAPI = {
  activate(): void {
    // No renderer views
  }
}

export default extension
