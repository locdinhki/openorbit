// ============================================================================
// ext-zillow — Renderer Entry Point
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'
import ZillowSidebar from './components/ZillowSidebar'
import ZillowWorkspace from './components/ZillowWorkspace'
import ArvCachePanel from './components/ArvCachePanel'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('zillow-sidebar', ZillowSidebar)
    ctx.views.register('zillow-workspace', ZillowWorkspace)
    ctx.views.register('zillow-cache', ArvCachePanel)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
