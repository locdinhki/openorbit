// ============================================================================
// OpenOrbit — Shell Store (minimal shell-level state)
// ============================================================================

import { create } from 'zustand'
import type { ExtensionManifest, SidebarContribution } from '@openorbit/core/extensions/types'
import type { Schedule } from '@openorbit/core/db/schedules-repo'
import type { ToolMeta } from '@openorbit/core/automation/scheduler-types'

export interface ShellState {
  /** All discovered extension manifests */
  extensions: ExtensionManifest[]
  /** ID of the active sidebar view */
  activeSidebarId: string | null
  /** ID of the active workspace view */
  activeWorkspaceId: string | null
  /** ID of the active right-panel view */
  activePanelId: string | null
  /** Whether the browser session is initialized */
  sessionInitialized: boolean

  /** Schedules state */
  schedules: Schedule[]
  tools: ToolMeta[]
  schedulesLoading: boolean
  wizardOpen: boolean
  editingScheduleId: string | null
  executingScheduleIds: Set<string>

  // Actions
  setExtensions: (extensions: ExtensionManifest[]) => void
  setActiveSidebar: (id: string | null) => void
  setActiveWorkspace: (id: string | null) => void
  setActivePanel: (id: string | null) => void
  setSessionInitialized: (initialized: boolean) => void

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
  activeSidebarId: null,
  activeWorkspaceId: null,
  activePanelId: null,
  sessionInitialized: false,

  schedules: [],
  tools: [],
  schedulesLoading: false,
  wizardOpen: false,
  editingScheduleId: null,
  executingScheduleIds: new Set<string>(),

  setExtensions: (extensions) => {
    set((state) => {
      // If no active views yet, set defaults from contributions
      let activeSidebarId = state.activeSidebarId
      let activeWorkspaceId = state.activeWorkspaceId
      let activePanelId = state.activePanelId

      if (!activeSidebarId) {
        // Pick highest priority sidebar
        const sidebars = extensions
          .flatMap((ext) => ext.contributes.sidebar ?? [])
          .sort((a, b) => b.priority - a.priority)
        activeSidebarId = sidebars[0]?.id ?? null
      }

      if (!activeWorkspaceId) {
        // Pick the default workspace, or first available
        const workspaces = extensions.flatMap((ext) => ext.contributes.workspace ?? [])
        activeWorkspaceId =
          workspaces.find((w) => w.default)?.id ?? workspaces[0]?.id ?? null
      }

      if (!activePanelId) {
        const panels = extensions.flatMap((ext) => ext.contributes.panel ?? [])
        activePanelId = panels[0]?.id ?? null
      }

      return { extensions, activeSidebarId, activeWorkspaceId, activePanelId }
    })
  },

  setActiveSidebar: (id) => set({ activeSidebarId: id }),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  setActivePanel: (id) => set({ activePanelId: id }),
  setSessionInitialized: (initialized) => set({ sessionInitialized: initialized }),

  // Schedule actions
  setSchedules: (schedules) => set({ schedules }),
  setTools: (tools) => set({ tools }),
  setSchedulesLoading: (loading) => set({ schedulesLoading: loading }),
  openWizard: (scheduleId) =>
    set({ wizardOpen: true, editingScheduleId: scheduleId ?? null }),
  closeWizard: () => set({ wizardOpen: false, editingScheduleId: null }),
  addScheduleToList: (schedule) =>
    set((state) => ({ schedules: [schedule, ...state.schedules] })),
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
 * Get all sidebar contributions from all extensions, sorted by priority.
 */
export function getAllSidebarContributions(
  extensions: ExtensionManifest[]
): SidebarContribution[] {
  return extensions
    .flatMap((ext) => ext.contributes.sidebar ?? [])
    .sort((a, b) => b.priority - a.priority)
}
