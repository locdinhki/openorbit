// ============================================================================
// ext-ghl — Renderer Entry Point
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'
import GhlSidebar from './components/GhlSidebar'
import GhlWorkspace from './components/GhlWorkspace'
import GhlChatPanel from './components/GhlChatPanel'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('ghl-sidebar', GhlSidebar)
    ctx.views.register('ghl-workspace', GhlWorkspace)
    ctx.views.register('ghl-chat', GhlChatPanel)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
