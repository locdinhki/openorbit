// ============================================================================
// OpenOrbit — Shell Store (minimal shell-level state)
// ============================================================================

import { create } from 'zustand'
import type { ExtensionManifest, SidebarContribution } from '@openorbit/core/extensions/types'
import type { Schedule } from '@openorbit/core/db/schedules-repo'
import type { ToolMeta } from '@openorbit/core/automation/scheduler-types'
import { SHELL_SIDEBAR_ITEMS } from '../components/Shell/shell-sidebar-items'

export interface ShellState {
  /** All discovered extension manifests */
  extensions: ExtensionManifest[]
  /** Extension enabled state: extensionId → boolean */
  extensionEnabledMap: Record<string, boolean>
  /** ID of the active sidebar view */
  activeSidebarId: string | null
  /** ID of the active workspace view */
  activeWorkspaceId: string | null
  /** ID of the active right-panel view */
  activePanelId: string | null
  /** Whether the browser session is initialized */
  sessionInitialized: boolean
  /** Per-extension layout sizes: sidebarId → { sidebar?, panel?, ... } */
  layoutSizes: Record<string, Record<string, number>>

  /** Command palette */
  commandPaletteOpen: boolean

  /** Update state */
  updateVersion: string | null
  updateReady: boolean
  updateDownloading: boolean

  /** Schedules state */
  schedules: Schedule[]
  tools: ToolMeta[]
  schedulesLoading: boolean
  wizardOpen: boolean
  editingScheduleId: string | null
  executingScheduleIds: Set<string>

  // Actions
  setExtensions: (extensions: ExtensionManifest[], enabledMap?: Record<string, boolean>) => void
  setExtensionEnabled: (id: string, enabled: boolean) => void
  setActiveSidebar: (id: string | null) => void
  setActiveWorkspace: (id: string | null) => void
  setActivePanel: (id: string | null) => void
  setSessionInitialized: (initialized: boolean) => void
  setLayoutSize: (sidebarId: string, slot: string, width: number) => void
  loadLayoutSizes: (sizes: Record<string, Record<string, number>>) => void

  // Command palette actions
  openCommandPalette: () => void
  closeCommandPalette: () => void
  toggleCommandPalette: () => void

  // Update actions
  setUpdateAvailable: (version: string) => void
  setUpdateReady: () => void
  setUpdateDownloading: (downloading: boolean) => void
  clearUpdate: () => void

  // Schedule actions
  setSchedules: (schedules: Schedule[]) => void
  setTools: (tools: ToolMeta[]) => void
  setSchedulesLoading: (loading: boolean) => void
  openWizard: (scheduleId?: string) => void
  closeWizard: () => void
  addScheduleToList: (schedule: Schedule) => void
  updateScheduleInList: (schedule: Schedule) => void
  removeScheduleFromList: (id: string) => void
  markScheduleExecuting: (id: string) => void
  markScheduleIdle: (id: string) => void
}

export const useShellStore = create<ShellState>()((set) => ({
  extensions: [],
  extensionEnabledMap: {},
  activeSidebarId: null,
  activeWorkspaceId: null,
  activePanelId: null,
  sessionInitialized: false,
  layoutSizes: {},

  commandPaletteOpen: false,

  updateVersion: null,
  updateReady: false,
  updateDownloading: false,

  schedules: [],
  tools: [],
  schedulesLoading: false,
  wizardOpen: false,
  editingScheduleId: null,
  executingScheduleIds: new Set<string>(),

  setExtensions: (extensions, enabledMap) => {
    set((state) => {
      const extensionEnabledMap = enabledMap ?? state.extensionEnabledMap

      // Only consider enabled extensions for default view selection
      const enabledExts = extensions.filter((ext) => extensionEnabledMap[ext.id] !== false)

      // If no active views yet, set defaults from contributions
      let activeSidebarId = state.activeSidebarId
      let activeWorkspaceId = state.activeWorkspaceId
      let activePanelId = state.activePanelId

      if (!activeSidebarId) {
        // Pick highest priority sidebar from enabled extensions
        const sidebars = enabledExts
          .flatMap((ext) => ext.contributes.sidebar ?? [])
          .sort((a, b) => b.priority - a.priority)
        activeSidebarId = sidebars[0]?.id ?? null
      }

      // Bind workspace + panel to the extension that owns the active sidebar
      const ownerExt = enabledExts.find((ext) =>
        ext.contributes.sidebar?.some((s) => s.id === activeSidebarId)
      )

      if (!activeWorkspaceId) {
        activeWorkspaceId = ownerExt?.contributes.workspace?.[0]?.id ?? null
      }

      if (!activePanelId) {
        activePanelId = ownerExt?.contributes.panel?.[0]?.id ?? null
      }

      return {
        extensions,
        extensionEnabledMap,
        activeSidebarId,
        activeWorkspaceId,
        activePanelId
      }
    })
  },

  setExtensionEnabled: (id, enabled) =>
    set((state) => ({
      extensionEnabledMap: { ...state.extensionEnabledMap, [id]: enabled }
    })),

  setActiveSidebar: (id) =>
    set((state) => {
      // Find the extension that owns this sidebar and switch workspace + panel to match
      const ownerExt = state.extensions.find((ext) =>
        ext.contributes.sidebar?.some((s) => s.id === id)
      )
      if (ownerExt) {
        const workspace = ownerExt.contributes.workspace?.[0]?.id ?? null
        const panel = ownerExt.contributes.panel?.[0]?.id ?? null
        return { activeSidebarId: id, activeWorkspaceId: workspace, activePanelId: panel }
      }
      return { activeSidebarId: id }
    }),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  setActivePanel: (id) => set({ activePanelId: id }),
  setSessionInitialized: (initialized) => set({ sessionInitialized: initialized }),
  setLayoutSize: (sidebarId, slot, width) =>
    set((state) => ({
      layoutSizes: {
        ...state.layoutSizes,
        [sidebarId]: { ...state.layoutSizes[sidebarId], [slot]: width }
      }
    })),
  loadLayoutSizes: (sizes) => set({ layoutSizes: sizes }),

  // Command palette actions
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

  // Update actions
  setUpdateAvailable: (version) => set({ updateVersion: version, updateReady: false }),
  setUpdateReady: () => set({ updateReady: true, updateDownloading: false }),
  setUpdateDownloading: (downloading) => set({ updateDownloading: downloading }),
  clearUpdate: () => set({ updateVersion: null, updateReady: false, updateDownloading: false }),

  // Schedule actions
  setSchedules: (schedules) => set({ schedules }),
  setTools: (tools) => set({ tools }),
  setSchedulesLoading: (loading) => set({ schedulesLoading: loading }),
  openWizard: (scheduleId) => set({ wizardOpen: true, editingScheduleId: scheduleId ?? null }),
  closeWizard: () => set({ wizardOpen: false, editingScheduleId: null }),
  addScheduleToList: (schedule) => set((state) => ({ schedules: [schedule, ...state.schedules] })),
  updateScheduleInList: (schedule) =>
    set((state) => ({
      schedules: state.schedules.map((s) => (s.id === schedule.id ? schedule : s))
    })),
  removeScheduleFromList: (id) =>
    set((state) => ({ schedules: state.schedules.filter((s) => s.id !== id) })),
  markScheduleExecuting: (id) =>
    set((state) => {
      const next = new Set(state.executingScheduleIds)
      next.add(id)
      return { executingScheduleIds: next }
    }),
  markScheduleIdle: (id) =>
    set((state) => {
      const next = new Set(state.executingScheduleIds)
      next.delete(id)
      return { executingScheduleIds: next }
    })
}))

// ---------------------------------------------------------------------------
// Derived selectors
// ---------------------------------------------------------------------------

/**
 * Get all sidebar contributions from extensions, excluding items promoted to shell group.
 */
const shellSidebarIds = new Set(SHELL_SIDEBAR_ITEMS.map((s) => s.id))

export function getAllSidebarContributions(
  extensions: ExtensionManifest[],
  enabledMap?: Record<string, boolean>
): SidebarContribution[] {
  return extensions
    .filter((ext) => !enabledMap || enabledMap[ext.id] !== false)
    .flatMap((ext) => ext.contributes.sidebar ?? [])
    .filter((s) => !shellSidebarIds.has(s.id))
    .sort((a, b) => b.priority - a.priority)
}
