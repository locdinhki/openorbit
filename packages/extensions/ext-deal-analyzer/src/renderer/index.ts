// ============================================================================
// ext-deal-analyzer — Renderer Entry Point
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'
import DealSidebar from './components/DealSidebar'
import DealWorkspace from './components/DealWorkspace'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('deal-analyzer-sidebar', DealSidebar)
    ctx.views.register('deal-analyzer-workspace', DealWorkspace)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
