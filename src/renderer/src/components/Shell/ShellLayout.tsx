// ============================================================================
// OpenOrbit — Shell Layout
//
// The root layout component that replaces the old hardcoded ThreePanel.
// Reads extension contributions from the shell store and renders
// views in designated slots (activity bar, sidebar, workspace, panel, etc.).
// ============================================================================

import { useRef, useCallback, useEffect } from 'react'
import { useShellStore, getAllSidebarContributions } from '../../store/shell-store'
import ActivityBar from './ActivityBar'
import SidebarContainer from './SidebarContainer'
import WorkspaceContainer from './WorkspaceContainer'
import PanelContainer from './PanelContainer'
import StatusBarContainer from './StatusBarContainer'
import ToolbarContainer from './ToolbarContainer'
import TitleBar from './TitleBar'
import CommandPalette from './CommandPalette'
import ResizeHandle from './ResizeHandle'
import { SHELL_SIDEBAR_ITEMS } from './shell-sidebar-items'
import { ipc } from '../../lib/ipc-client'

const SIDEBAR_MIN = 260
const SIDEBAR_MAX = 700
const SIDEBAR_DEFAULT = 550

const PANEL_MIN = 240
const PANEL_MAX = 500
const PANEL_DEFAULT = 300

function persistLayoutSizes(): void {
  const sizes = useShellStore.getState().layoutSizes
  ipc.settings.update('ui.layout-sizes', JSON.stringify(sizes))
}

export default function ShellLayout(): React.JSX.Element {
  const {
    extensions,
    extensionEnabledMap,
    activeSidebarId,
    activeWorkspaceId,
    activePanelId,
    layoutSizes,
    commandPaletteOpen,
    setActiveSidebar,
    setActivePanel,
    setLayoutSize,
    openCommandPalette,
    closeCommandPalette
  } = useShellStore()

  const sidebarRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const enabledExts = extensions.filter((ext) => extensionEnabledMap[ext.id] !== false)
  const extensionSidebarItems = getAllSidebarContributions(extensions, extensionEnabledMap)
  const statusBarItems = enabledExts.flatMap((ext) => ext.contributes.statusBar ?? [])
  const toolbarItems = enabledExts.flatMap((ext) => ext.contributes.toolbar ?? [])
  // Scope panels to the extension that owns the active sidebar
  const activeExt = extensions.find((ext) =>
    ext.contributes.sidebar?.some((s) => s.id === activeSidebarId)
  )
  const panelItems = activeExt?.contributes.panel ?? []

  // Get stored sizes for the active extension (or defaults)
  const currentSizes = activeSidebarId ? layoutSizes[activeSidebarId] : undefined
  const sidebarWidth = currentSizes?.sidebar ?? SIDEBAR_DEFAULT
  const panelWidth = currentSizes?.panel ?? PANEL_DEFAULT

  // Apply stored sizes to refs when extension switches
  useEffect(() => {
    if (sidebarRef.current) sidebarRef.current.style.width = `${sidebarWidth}px`
    if (panelRef.current) panelRef.current.style.width = `${panelWidth}px`
  }, [activeSidebarId, sidebarWidth, panelWidth])

  const handleSidebarResize = useCallback(
    (delta: number) => {
      const el = sidebarRef.current
      if (!el || !activeSidebarId) return
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, el.offsetWidth + delta))
      el.style.width = `${newWidth}px`
      setLayoutSize(activeSidebarId, 'sidebar', newWidth)
    },
    [activeSidebarId, setLayoutSize]
  )

  const handlePanelResize = useCallback(
    (delta: number) => {
      const el = panelRef.current
      if (!el || !activeSidebarId) return
      // Panel grows leftward, so invert delta
      const newWidth = Math.min(PANEL_MAX, Math.max(PANEL_MIN, el.offsetWidth - delta))
      el.style.width = `${newWidth}px`
      setLayoutSize(activeSidebarId, 'panel', newWidth)
    },
    [activeSidebarId, setLayoutSize]
  )

  // Subscribe to auto-update push events from main process
  useEffect(() => {
    const unsubs = [
      ipc.update.onAvailable((data) => {
        useShellStore.getState().setUpdateAvailable(data.version)
      }),
      ipc.update.onReady(() => {
        useShellStore.getState().setUpdateReady()
      })
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [])

  // Global Cmd/Ctrl+K shortcut for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        useShellStore.getState().toggleCommandPalette()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Shell sidebar items take the full content area (no workspace/panel)
  const isShellSidebar = activeSidebarId?.startsWith('shell-') ?? false

  return (
    <div className="flex flex-col h-screen bg-[var(--cos-bg-primary)]">
      {/* Custom Title Bar */}
      <TitleBar onCommandPaletteOpen={openCommandPalette} />

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
              style={{ width: sidebarWidth }}
            >
              <SidebarContainer activeId={activeSidebarId} />
            </div>

            <ResizeHandle onResize={handleSidebarResize} onResizeEnd={persistLayoutSizes} />

            {/* Center: Toolbar + Workspace */}
            <div className="flex-1 min-w-0 flex flex-col">
              <ToolbarContainer items={toolbarItems} />
              <div className="flex-1 min-h-0">
                <WorkspaceContainer activeId={activeWorkspaceId} />
              </div>
            </div>

            {/* Right Panel — only shown when extension has panels */}
            {panelItems.length > 0 && (
              <>
                <ResizeHandle onResize={handlePanelResize} onResizeEnd={persistLayoutSizes} />
                <div
                  ref={panelRef}
                  className="flex-shrink-0 border-l border-[var(--cos-border)] bg-[var(--cos-bg-secondary)]"
                  style={{ width: panelWidth }}
                >
                  <PanelContainer
                    activeId={activePanelId}
                    panels={panelItems}
                    onSelectPanel={setActivePanel}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Status Bar */}
      <StatusBarContainer items={statusBarItems} />

      {/* Command Palette Overlay — conditionally mounted for fresh state each open */}
      {commandPaletteOpen && <CommandPalette onClose={closeCommandPalette} />}
    </div>
  )
}
