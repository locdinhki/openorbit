// ============================================================================
// OpenOrbit — Shell Layout
//
// The root layout component that replaces the old hardcoded ThreePanel.
// Reads extension contributions from the shell store and renders
// views in designated slots (activity bar, sidebar, workspace, panel, etc.).
// ============================================================================

import { useRef, useCallback } from 'react'
import { useShellStore, getAllSidebarContributions } from '../../store/shell-store'
import ActivityBar from './ActivityBar'
import SidebarContainer from './SidebarContainer'
import WorkspaceContainer from './WorkspaceContainer'
import PanelContainer from './PanelContainer'
import StatusBarContainer from './StatusBarContainer'
import ToolbarContainer from './ToolbarContainer'
import ResizeHandle from './ResizeHandle'
import { SHELL_SIDEBAR_ITEMS } from './shell-sidebar-items'

const SIDEBAR_MIN = 260
const SIDEBAR_MAX = 700
const SIDEBAR_DEFAULT = 550

const PANEL_MIN = 240
const PANEL_MAX = 500
const PANEL_DEFAULT = 300

export default function ShellLayout(): React.JSX.Element {
  const {
    extensions,
    activeSidebarId,
    activeWorkspaceId,
    activePanelId,
    setActiveSidebar,
    setActivePanel
  } = useShellStore()

  const sidebarRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const extensionSidebarItems = getAllSidebarContributions(extensions)
  const statusBarItems = extensions.flatMap((ext) => ext.contributes.statusBar ?? [])
  const toolbarItems = extensions.flatMap((ext) => ext.contributes.toolbar ?? [])
  const panelItems = extensions.flatMap((ext) => ext.contributes.panel ?? [])

  const handleSidebarResize = useCallback((delta: number) => {
    const el = sidebarRef.current
    if (!el) return
    const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, el.offsetWidth + delta))
    el.style.width = `${newWidth}px`
  }, [])

  const handlePanelResize = useCallback((delta: number) => {
    const el = panelRef.current
    if (!el) return
    // Panel grows leftward, so invert delta
    const newWidth = Math.min(PANEL_MAX, Math.max(PANEL_MIN, el.offsetWidth - delta))
    el.style.width = `${newWidth}px`
  }, [])

  // Shell sidebar items take the full content area (no workspace/panel)
  const isShellSidebar = activeSidebarId?.startsWith('shell-') ?? false

  return (
    <div className="flex flex-col h-screen bg-[var(--cos-bg-primary)]">
      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Activity Bar (leftmost icon strip) */}
        <ActivityBar
          shellItems={SHELL_SIDEBAR_ITEMS}
          extensionItems={extensionSidebarItems}
          activeId={activeSidebarId}
          onSelect={setActiveSidebar}
        />

        {isShellSidebar ? (
          /* Shell sidebar — full width, no workspace/panel */
          <div className="flex-1 min-w-0 overflow-y-auto bg-[var(--cos-bg-secondary)]">
            <SidebarContainer activeId={activeSidebarId} />
          </div>
        ) : (
          /* Extension sidebar — three-panel layout */
          <>
            <div
              ref={sidebarRef}
              className="flex-shrink-0 overflow-y-auto border-r border-[var(--cos-border)] bg-[var(--cos-bg-secondary)]"
              style={{ width: SIDEBAR_DEFAULT }}
            >
              <SidebarContainer activeId={activeSidebarId} />
            </div>

            <ResizeHandle onResize={handleSidebarResize} />

            {/* Center: Toolbar + Workspace */}
            <div className="flex-1 min-w-0 flex flex-col">
              <ToolbarContainer items={toolbarItems} />
              <div className="flex-1 min-h-0">
                <WorkspaceContainer activeId={activeWorkspaceId} />
              </div>
            </div>

            <ResizeHandle onResize={handlePanelResize} />

            {/* Right Panel */}
            <div
              ref={panelRef}
              className="flex-shrink-0 border-l border-[var(--cos-border)] bg-[var(--cos-bg-secondary)]"
              style={{ width: PANEL_DEFAULT }}
            >
              <PanelContainer
                activeId={activePanelId}
                panels={panelItems}
                onSelectPanel={setActivePanel}
              />
            </div>
          </>
        )}
      </div>

      {/* Status Bar */}
      <StatusBarContainer items={statusBarItems} />
    </div>
  )
}
