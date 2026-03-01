// ============================================================================
// ext-bookkeeping — Renderer Entry Point
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'
import BookkeepingSidebar from './components/BookkeepingSidebar'
import BookkeepingWorkspace from './components/BookkeepingWorkspace'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('bookkeeping-sidebar', BookkeepingSidebar)
    ctx.views.register('bookkeeping-workspace', BookkeepingWorkspace)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
