// ============================================================================
// ext-hive — Renderer Entry Point
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'
import HiveSidebar from './components/HiveSidebar'
import HiveWorkspace from './components/HiveWorkspace'
import HiveAgentPanel from './components/HiveAgentPanel'
import HiveTerminal from './components/HiveTerminal'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('hive-sidebar', HiveSidebar)
    ctx.views.register('hive-workspace', HiveWorkspace)
    ctx.views.register('hive-agent', HiveAgentPanel)
    ctx.views.register('hive-terminal', HiveTerminal)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
