// ============================================================================
// ext-plaid — Renderer Entry Point
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'
import PlaidSidebar from './components/PlaidSidebar'
import PlaidWorkspace from './components/PlaidWorkspace'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('plaid-sidebar', PlaidSidebar)
    ctx.views.register('plaid-workspace', PlaidWorkspace)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
