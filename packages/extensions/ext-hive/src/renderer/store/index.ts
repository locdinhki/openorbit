// ============================================================================
// ext-hive — Zustand Store
// ============================================================================

import { create } from 'zustand'
import type { Device, Task, TaskWithResults, InstructionType, Schedule } from '../../main/types'
import { ipc } from '../lib/ipc-client'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ExtHiveStore {
  // Devices
  devices: Device[]
  devicesLoading: boolean
  devicesError: string | null
  loadDevices: () => Promise<void>

  // Task dispatch
  targetDevice: string
  setTargetDevice: (id: string) => void
  instructionType: InstructionType
  setInstructionType: (type: InstructionType) => void
  instructionFields: Record<string, string>
  setInstructionField: (key: string, value: string) => void
  resetInstruction: () => void
  dispatching: boolean
  dispatchError: string | null
  dispatchTask: () => Promise<void>

  // Task history
  tasks: Task[]
  tasksLoading: boolean
  tasksFilter: { deviceId?: string; status?: string }
  setTasksFilter: (filter: { deviceId?: string; status?: string }) => void
  loadTasks: () => Promise<void>

  // Task detail
  selectedTask: TaskWithResults | null
  selectedTaskLoading: boolean
  selectTask: (id: string) => Promise<void>
  clearSelectedTask: () => void

  // Schedules
  schedules: Schedule[]
  schedulesLoading: boolean
  loadSchedules: () => Promise<void>
  createSchedule: (params: {
    deviceId: string
    name: string
    instruction: Record<string, unknown>
    cronExpression: string
  }) => Promise<boolean>
  toggleSchedule: (schedule: Schedule) => Promise<void>
  deleteSchedule: (id: string) => Promise<void>

  // Chat
  chatMessages: ChatMessage[]
  chatLoading: boolean
  sendChatMessage: (message: string) => Promise<void>
  clearChat: () => void
}

export const useExtHiveStore = create<ExtHiveStore>()((set, get) => ({
  // ── Devices ───────────────────────────────────────────────────────────────
  devices: [],
  devicesLoading: false,
  devicesError: null,
  loadDevices: async () => {
    set({ devicesLoading: true, devicesError: null })
    const res = await ipc.listDevices()
    if (res.success && res.data) {
      set({ devices: res.data, devicesLoading: false })
    } else {
      set({ devicesError: res.error ?? 'Failed to load devices', devicesLoading: false })
    }
  },

  // ── Task Dispatch ─────────────────────────────────────────────────────────
  targetDevice: '',
  setTargetDevice: (id) => set({ targetDevice: id }),
  instructionType: 'exec',
  setInstructionType: (type) => set({ instructionType: type, instructionFields: {} }),
  instructionFields: {},
  setInstructionField: (key, value) =>
    set((s) => ({ instructionFields: { ...s.instructionFields, [key]: value } })),
  resetInstruction: () => set({ instructionFields: {}, dispatchError: null }),
  dispatching: false,
  dispatchError: null,
  dispatchTask: async () => {
    const { targetDevice, instructionType, instructionFields } = get()
    if (!targetDevice) {
      set({ dispatchError: 'Select a target device' })
      return
    }

    set({ dispatching: true, dispatchError: null })
    const instruction = { type: instructionType, ...instructionFields }
    const res = await ipc.dispatchTask({ targetDevice, instruction })
    if (res.success) {
      set({ dispatching: false, instructionFields: {} })
      // Reload task list
      get().loadTasks()
    } else {
      set({ dispatching: false, dispatchError: res.error ?? 'Dispatch failed' })
    }
  },

  // ── Task History ──────────────────────────────────────────────────────────
  tasks: [],
  tasksLoading: false,
  tasksFilter: {},
  setTasksFilter: (filter) => set({ tasksFilter: filter }),
  loadTasks: async () => {
    set({ tasksLoading: true })
    const { tasksFilter } = get()
    const res = await ipc.listTasks({ ...tasksFilter, limit: 100 })
    if (res.success && res.data) {
      set({ tasks: res.data, tasksLoading: false })
    } else {
      set({ tasksLoading: false })
    }
  },

  // ── Task Detail ───────────────────────────────────────────────────────────
  selectedTask: null,
  selectedTaskLoading: false,
  selectTask: async (id) => {
    set({ selectedTaskLoading: true })
    const res = await ipc.getTask(id)
    if (res.success && res.data) {
      set({ selectedTask: res.data, selectedTaskLoading: false })
    } else {
      set({ selectedTaskLoading: false })
    }
  },
  clearSelectedTask: () => set({ selectedTask: null }),

  // ── Schedules ──────────────────────────────────────────────────────────
  schedules: [],
  schedulesLoading: false,
  loadSchedules: async () => {
    set({ schedulesLoading: true })
    const res = await ipc.listSchedules()
    if (res.success && res.data) {
      set({ schedules: res.data, schedulesLoading: false })
    } else {
      set({ schedulesLoading: false })
    }
  },
  createSchedule: async (params) => {
    const res = await ipc.createSchedule(params)
    if (res.success) {
      get().loadSchedules()
      return true
    }
    return false
  },
  toggleSchedule: async (schedule) => {
    await ipc.updateSchedule(schedule.id, { enabled: !schedule.enabled })
    get().loadSchedules()
  },
  deleteSchedule: async (id) => {
    await ipc.deleteSchedule(id)
    get().loadSchedules()
  },

  // ── Chat ────────────────────────────────────────────────────────────────
  chatMessages: [],
  chatLoading: false,
  sendChatMessage: async (message) => {
    set((s) => ({
      chatMessages: [...s.chatMessages, { role: 'user' as const, content: message }],
      chatLoading: true
    }))

    const res = await ipc.chatSend(message)
    if (res.success && res.data) {
      set((s) => ({
        chatMessages: [...s.chatMessages, { role: 'assistant' as const, content: res.data! }],
        chatLoading: false
      }))
    } else {
      set((s) => ({
        chatMessages: [
          ...s.chatMessages,
          { role: 'system' as const, content: `Error: ${res.error ?? 'Failed to get response'}` }
        ],
        chatLoading: false
      }))
    }
  },
  clearChat: () => {
    set({ chatMessages: [] })
    ipc.chatClear()
  }
}))
