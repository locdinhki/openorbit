// ============================================================================
// OpenOrbit — Status Bar Container
// ============================================================================

import { Suspense } from 'react'
import { getExtensionView } from '../../lib/extension-renderer'
import type { StatusBarContribution } from '@openorbit/core/extensions/types'

interface StatusBarContainerProps {
  items: StatusBarContribution[]
}

export default function StatusBarContainer({
  items
}: StatusBarContainerProps): React.JSX.Element {
  const leftItems = items
    .filter((i) => i.alignment === 'left')
    .sort((a, b) => b.priority - a.priority)

  const rightItems = items
    .filter((i) => i.alignment === 'right')
    .sort((a, b) => b.priority - a.priority)

  return (
    <div className="flex items-center px-3 py-1 border-t border-[var(--cos-border)] bg-[var(--cos-bg-secondary)] text-[10px] text-[var(--cos-text-tertiary)] flex-shrink-0">
      {/* Left-aligned items */}
      <div className="flex items-center gap-3">
        {leftItems.map((item) => {
          const Component = getExtensionView(item.id) as React.ComponentType | null
          if (!Component) return null
          return (
            <Suspense key={item.id} fallback={null}>
              <Component />
            </Suspense>
          )
        })}
      </div>

      <div className="flex-1" />

      {/* Right-aligned items */}
      <div className="flex items-center gap-3">
        {rightItems.map((item) => {
          const Component = getExtensionView(item.id) as React.ComponentType | null
          if (!Component) return null
          return (
            <Suspense key={item.id} fallback={null}>
              <Component />
            </Suspense>
          )
        })}
      </div>
    </div>
  )
}
