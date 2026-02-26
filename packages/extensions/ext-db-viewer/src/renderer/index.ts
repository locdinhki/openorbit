// ============================================================================
// ext-db-viewer — Renderer Entry Point
//
// Registers all view components contributed by the database viewer extension
// into the shell's view registry via the ExtensionRendererContext.
// ============================================================================

import type { ExtensionRendererAPI, ExtensionRendererContext } from '@openorbit/core/extensions/types'

import DbViewerSidebar from './components/DbViewerSidebar'
import DbViewerWorkspace from './components/DbViewerWorkspace'
import SqlConsolePanel from './components/SqlConsole/SqlConsolePanel'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('db-viewer-sidebar', DbViewerSidebar)
    ctx.views.register('db-viewer-workspace', DbViewerWorkspace)
    ctx.views.register('db-viewer-sql', SqlConsolePanel)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
