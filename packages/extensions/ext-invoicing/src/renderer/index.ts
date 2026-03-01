// ============================================================================
// ext-invoicing — Renderer Entry Point
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'
import InvoicingSidebar from './components/InvoicingSidebar'
import InvoicingWorkspace from './components/InvoicingWorkspace'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('invoicing-sidebar', InvoicingSidebar)
    ctx.views.register('invoicing-workspace', InvoicingWorkspace)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
