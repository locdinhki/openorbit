// ============================================================================
// OpenOrbit — Toolbar Container (above workspace)
// ============================================================================

import { Suspense } from 'react'
import { getExtensionView } from '../../lib/extension-renderer'
import type { ToolbarContribution } from '@openorbit/core/extensions/types'

interface ToolbarContainerProps {
  items: ToolbarContribution[]
}

export default function ToolbarContainer({ items }: ToolbarContainerProps): React.JSX.Element {
  const sorted = [...items].sort((a, b) => b.priority - a.priority)

  // If no extensions contributed toolbar items, render a minimal bar
  if (sorted.length === 0) {
    return (
      <div className="flex items-center px-3 py-1.5 border-b border-[var(--cos-border)] bg-[var(--cos-bg-secondary)] flex-shrink-0 min-h-[36px]" />
    )
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--cos-border)] bg-[var(--cos-bg-secondary)] flex-shrink-0">
      {sorted.map((item) => {
        const Component = getExtensionView(item.id) as React.ComponentType | null
        if (!Component) return null
        return (
          <Suspense key={item.id} fallback={null}>
            <Component />
          </Suspense>
        )
      })}
    </div>
  )
}
