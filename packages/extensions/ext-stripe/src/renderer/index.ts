// ============================================================================
// ext-stripe — Renderer Entry Point
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'
import StripeSidebar from './components/StripeSidebar'
import StripeWorkspace from './components/StripeWorkspace'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('stripe-sidebar', StripeSidebar)
    ctx.views.register('stripe-workspace', StripeWorkspace)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
