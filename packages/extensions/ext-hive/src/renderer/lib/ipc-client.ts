// ============================================================================
// ext-hive — Renderer IPC Client
// ============================================================================

import { EXT_HIVE_IPC } from '../../ipc-channels'
import type { Device, Task, TaskWithResults, Schedule } from '../../main/types'

interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

const api = window.api

export const ipc = {
  listDevices: (): Promise<IPCResult<Device[]>> =>
    api.invoke(EXT_HIVE_IPC.LIST_DEVICES, {}) as Promise<IPCResult<Device[]>>,

  getDevice: (id: string): Promise<IPCResult<Device>> =>
    api.invoke(EXT_HIVE_IPC.GET_DEVICE, { id }) as Promise<IPCResult<Device>>,

  dispatchTask: (params: {
    targetDevice: string
    instruction: Record<string, unknown>
    priority?: string
  }): Promise<IPCResult<Task>> =>
    api.invoke(EXT_HIVE_IPC.DISPATCH_TASK, params) as Promise<IPCResult<Task>>,

  getTask: (id: string): Promise<IPCResult<TaskWithResults>> =>
    api.invoke(EXT_HIVE_IPC.GET_TASK, { id }) as Promise<IPCResult<TaskWithResults>>,

  listTasks: (filter?: {
    deviceId?: string
    status?: string
    limit?: number
  }): Promise<IPCResult<Task[]>> =>
    api.invoke(EXT_HIVE_IPC.LIST_TASKS, filter ?? {}) as Promise<IPCResult<Task[]>>,

  health: (): Promise<IPCResult<{ status: string; uptime: number }>> =>
    api.invoke(EXT_HIVE_IPC.HEALTH, {}) as Promise<IPCResult<{ status: string; uptime: number }>>,

  // Schedules
  listSchedules: (deviceId?: string): Promise<IPCResult<Schedule[]>> =>
    api.invoke(EXT_HIVE_IPC.LIST_SCHEDULES, { deviceId }) as Promise<IPCResult<Schedule[]>>,

  createSchedule: (params: {
    deviceId: string
    name: string
    instruction: Record<string, unknown>
    cronExpression: string
  }): Promise<IPCResult<Schedule>> =>
    api.invoke(EXT_HIVE_IPC.CREATE_SCHEDULE, params) as Promise<IPCResult<Schedule>>,

  updateSchedule: (id: string, updates: Record<string, unknown>): Promise<IPCResult<Schedule>> =>
    api.invoke(EXT_HIVE_IPC.UPDATE_SCHEDULE, { id, updates }) as Promise<IPCResult<Schedule>>,

  deleteSchedule: (id: string): Promise<IPCResult> =>
    api.invoke(EXT_HIVE_IPC.DELETE_SCHEDULE, { id }) as Promise<IPCResult>,

  // Chat
  chatSend: (message: string): Promise<IPCResult<string>> =>
    api.invoke(EXT_HIVE_IPC.CHAT_SEND, { message }) as Promise<IPCResult<string>>,

  chatClear: (): Promise<IPCResult> => api.invoke(EXT_HIVE_IPC.CHAT_CLEAR, {}) as Promise<IPCResult>
}

export type { IPCResult }
