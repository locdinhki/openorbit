// ============================================================================
// OpenOrbit — Shell-level sidebar items (built-in, not from extensions)
// ============================================================================

import type { SidebarContribution } from '@openorbit/core/extensions/types'

/**
 * Built-in shell sidebar items. Rendered at the top of the ActivityBar,
 * above the separator and extension-contributed items.
 */
export const SHELL_SIDEBAR_ITEMS: SidebarContribution[] = [
  { id: 'shell-extensions', label: 'Extensions', icon: 'blocks', priority: 1000 },
  { id: 'shell-automations', label: 'Automations', icon: 'zap', priority: 900 }
]
