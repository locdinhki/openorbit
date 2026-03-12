// ============================================================================
// ext-hive — Renderer Entry Point
// ============================================================================

import type {
  ExtensionRendererAPI,
  ExtensionRendererContext
} from '@openorbit/core/extensions/types'
import HiveDashboard from './components/HiveDashboard'
import HiveAgentPanel from './components/HiveAgentPanel'

const extension: ExtensionRendererAPI = {
  activate(ctx: ExtensionRendererContext): void {
    ctx.views.register('hive-sidebar', HiveDashboard)
    ctx.views.register('hive-workspace', HiveDashboard)
    ctx.views.register('hive-agent', HiveAgentPanel)
  },

  deactivate(): void {
    // No cleanup needed
  }
}

export default extension
