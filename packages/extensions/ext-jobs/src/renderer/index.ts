// ============================================================================
// ext-jobs — Renderer Entry Point
//
// Registers all view components contributed by the jobs extension
// into the shell's view registry via the ExtensionRendererContext.
//
// During transition: components are imported from their copied locations
// within the extension package. They still reference the old store (useStore)
// which will be migrated to useExtJobsStore incrementally.
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'

// Import the existing components that were moved to this extension.
// These are the same components, just living in the extension now.
import JobsSidebar from './components/JobsSidebar'
import JobWorkspace from './components/JobWorkspace'
import { ChatPanel, ActionLogPanel } from './components/JobsPanel'
import AutomationStatusBar from './components/AutomationStatusBar'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    // Register sidebar view (internal tabs handle Profiles/Jobs/Settings)
    ctx.views.register('jobs-sidebar', JobsSidebar)

    // Register workspace view
    ctx.views.register('job-workspace', JobWorkspace)

    // Register panel views (right side)
    ctx.views.register('jobs-chat', ChatPanel)
    ctx.views.register('action-log', ActionLogPanel)

    // Register status bar
    ctx.views.register('automation-status', AutomationStatusBar)

    // Register toolbar (browser controls)
    // TODO: Extract BrowserToolbar from ThreePanel and register here
    // ctx.views.register('browser-controls', BrowserToolbar)
  },

  deactivate(): void {
    // Cleanup if needed
  }
}

export default extension
