// ============================================================================
// OpenOrbit — Sidebar View Container
// ============================================================================

import { Suspense } from 'react'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { getExtensionView } from '../../lib/extension-renderer'

interface SidebarContainerProps {
  activeId: string | null
}

function SidebarSkeleton(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center h-full text-xs text-[var(--cos-text-tertiary)]">
      Loading...
    </div>
  )
}

export default function SidebarContainer({ activeId }: SidebarContainerProps): React.JSX.Element {
  if (!activeId) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-[var(--cos-text-tertiary)]">
        No sidebar view active
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
    <ErrorBoundary section={`Sidebar:${activeId}`}>
      <Suspense fallback={<SidebarSkeleton />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  )
}
