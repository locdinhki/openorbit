// ============================================================================
// OpenOrbit — Panel View Container (right side)
// ============================================================================

import { Suspense } from 'react'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { getExtensionView } from '../../lib/extension-renderer'
import type { PanelContribution } from '@openorbit/core/extensions/types'

interface PanelContainerProps {
  activeId: string | null
  panels: PanelContribution[]
  onSelectPanel: (id: string) => void
}

function PanelSkeleton(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center h-full text-xs text-[var(--cos-text-tertiary)]">
      Loading...
    </div>
  )
}

export default function PanelContainer({
  activeId,
  panels,
  onSelectPanel
}: PanelContainerProps): React.JSX.Element {
  const Component = activeId
    ? (getExtensionView(activeId) as React.ComponentType | null)
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Panel tab bar */}
      {panels.length > 1 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--cos-border)] flex-shrink-0">
          {panels.map((panel) => (
            <button
              key={panel.id}
              onClick={() => onSelectPanel(panel.id)}
              className={`px-2 py-1 text-[10px] rounded transition-colors ${
                activeId === panel.id
                  ? 'text-[var(--cos-text-primary)] bg-[var(--cos-bg-tertiary)]'
                  : 'text-[var(--cos-text-tertiary)] hover:text-[var(--cos-text-secondary)]'
              }`}
            >
              {panel.label}
            </button>
          ))}
        </div>
      )}

      {/* Panel content */}
      <div className="flex-1 min-h-0">
        {Component ? (
          <ErrorBoundary section={`Panel:${activeId}`}>
            <Suspense fallback={<PanelSkeleton />}>
              <Component />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-[var(--cos-text-tertiary)]">
            {activeId ? `View not registered: ${activeId}` : 'No panel view active'}
          </div>
        )}
      </div>
    </div>
  )
}
