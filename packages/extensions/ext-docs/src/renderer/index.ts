// ============================================================================
// ext-docs — Renderer Entry Point
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'
import DocsSidebar from './components/DocsSidebar'
import DocsWorkspace from './components/DocsWorkspace'
import DocsViewer from './components/DocsViewer'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('docs-sidebar', DocsSidebar)
    ctx.views.register('docs-workspace', DocsWorkspace)
    ctx.views.register('docs-viewer', DocsViewer)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
