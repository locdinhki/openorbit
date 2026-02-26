// ============================================================================
// OpenOrbit — Workspace View Container (center panel)
// ============================================================================

import { Suspense } from 'react'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { getExtensionView } from '../../lib/extension-renderer'

interface WorkspaceContainerProps {
  activeId: string | null
}

function WorkspaceSkeleton(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center h-full text-xs text-[var(--cos-text-tertiary)]">
      Loading workspace...
    </div>
  )
}

export default function WorkspaceContainer({
  activeId
}: WorkspaceContainerProps): React.JSX.Element {
  if (!activeId) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--cos-text-tertiary)]">
        No workspace view active
      </div>
    )
  }

  const Component = getExtensionView(activeId) as React.ComponentType | null
  if (!Component) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--cos-text-tertiary)]">
        View not registered: {activeId}
      </div>
    )
  }

  return (
    <ErrorBoundary section={`Workspace:${activeId}`}>
      <Suspense fallback={<WorkspaceSkeleton />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )
}
