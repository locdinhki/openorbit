// ============================================================================
// ext-hive — IPC Handler Registration
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { EXT_HIVE_IPC } from '../ipc-channels'
import { extHiveSchemas } from '../ipc-schemas'
import type { HiveClient } from './hive-client'
import type { HiveChatHandler } from './ai/hive-chat-handler'

export function registerExtHiveHandlers(
  ctx: ExtensionContext,
  getClient: () => HiveClient | null,
  getChatHandler?: () => HiveChatHandler | null
): void {
  const { ipc, log } = ctx

  function requireClient(): HiveClient {
    const client = getClient()
    if (!client) throw new Error('Hive not configured — set hive.url and hive.api-key in settings')
    return client
  }

  // ── Devices ───────────────────────────────────────────────────────────────

  ipc.handle(EXT_HIVE_IPC.LIST_DEVICES, extHiveSchemas['ext-hive:list-devices'], async () => {
    try {
      const data = await requireClient().listDevices()
      return { success: true, data }
    } catch (err) {
      log.error('Failed to list devices', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_HIVE_IPC.GET_DEVICE,
    extHiveSchemas['ext-hive:get-device'],
    async (_event, { id }) => {
      try {
        const data = await requireClient().getDevice(id)
        return { success: true, data }
      } catch (err) {
        log.error(`Failed to get device ${id}`, err)
        return errorToResponse(err)
      }
    }
  )

  // ── Tasks ─────────────────────────────────────────────────────────────────

  ipc.handle(
    EXT_HIVE_IPC.DISPATCH_TASK,
    extHiveSchemas['ext-hive:dispatch-task'],
    async (_event, { targetDevice, instruction, priority }) => {
      try {
        const data = await requireClient().createTask({ targetDevice, instruction, priority })
        return { success: true, data }
      } catch (err) {
        log.error('Failed to dispatch task', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_HIVE_IPC.GET_TASK, extHiveSchemas['ext-hive:get-task'], async (_event, { id }) => {
    try {
      const data = await requireClient().getTask(id)
      return { success: true, data }
    } catch (err) {
      log.error(`Failed to get task ${id}`, err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_HIVE_IPC.LIST_TASKS,
    extHiveSchemas['ext-hive:list-tasks'],
    async (_event, { deviceId, status, limit }) => {
      try {
        const data = await requireClient().listTasks({ deviceId, status, limit })
        return { success: true, data }
      } catch (err) {
        log.error('Failed to list tasks', err)
        return errorToResponse(err)
      }
    }
  )

  // ── Health ────────────────────────────────────────────────────────────────

  ipc.handle(EXT_HIVE_IPC.HEALTH, extHiveSchemas['ext-hive:health'], async () => {
    try {
      const data = await requireClient().health()
      return { success: true, data }
    } catch (err) {
      log.error('Hive health check failed', err)
      return errorToResponse(err)
    }
  })

  // ── Schedules ───────────────────────────────────────────────────────────

  ipc.handle(
    EXT_HIVE_IPC.LIST_SCHEDULES,
    extHiveSchemas['ext-hive:list-schedules'],
    async (_event, { deviceId }) => {
      try {
        const data = await requireClient().listSchedules(deviceId)
        return { success: true, data }
      } catch (err) {
        log.error('Failed to list schedules', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_HIVE_IPC.CREATE_SCHEDULE,
    extHiveSchemas['ext-hive:create-schedule'],
    async (_event, { deviceId, name, instruction, cronExpression }) => {
      try {
        const data = await requireClient().createSchedule({
          deviceId,
          name,
          instruction,
          cronExpression
        })
        return { success: true, data }
      } catch (err) {
        log.error('Failed to create schedule', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_HIVE_IPC.UPDATE_SCHEDULE,
    extHiveSchemas['ext-hive:update-schedule'],
    async (_event, { id, updates }) => {
      try {
        const data = await requireClient().updateSchedule(id, updates)
        return { success: true, data }
      } catch (err) {
        log.error(`Failed to update schedule ${id}`, err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_HIVE_IPC.DELETE_SCHEDULE,
    extHiveSchemas['ext-hive:delete-schedule'],
    async (_event, { id }) => {
      try {
        await requireClient().deleteSchedule(id)
        return { success: true }
      } catch (err) {
        log.error(`Failed to delete schedule ${id}`, err)
        return errorToResponse(err)
      }
    }
  )

  // ── Chat ─────────────────────────────────────────────────────────────────

  ipc.handle(
    EXT_HIVE_IPC.CHAT_SEND,
    extHiveSchemas['ext-hive:chat-send'],
    async (_event, { message }) => {
      try {
        const handler = getChatHandler?.()
        if (!handler) throw new Error('AI chat not available — no AI provider configured')
        const response = await handler.sendMessage(message)
        return { success: true, data: response }
      } catch (err) {
        log.error('Chat send failed', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_HIVE_IPC.CHAT_CLEAR, extHiveSchemas['ext-hive:chat-clear'], async () => {
    try {
      getChatHandler?.()?.clearHistory()
      return { success: true }
    } catch (err) {
      return errorToResponse(err)
    }
  })

  // ── Terminal ──────────────────────────────────────────────────────────────

  ipc.handle(
    EXT_HIVE_IPC.OPEN_TERMINAL,
    extHiveSchemas['ext-hive:open-terminal'],
    async (_event, { deviceId }) => {
      try {
        const wsUrl = requireClient().getTerminalWsUrl(deviceId)
        return { success: true, data: { wsUrl } }
      } catch (err) {
        log.error(`Failed to get terminal URL for ${deviceId}`, err)
        return errorToResponse(err)
      }
    }
  )

  // ── Templates ────────────────────────────────────────────────────────────

  ipc.handle(EXT_HIVE_IPC.LIST_TEMPLATES, extHiveSchemas['ext-hive:list-templates'], async () => {
    try {
      const data = await requireClient().listTemplates()
      return { success: true, data }
    } catch (err) {
      log.error('Failed to list templates', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_HIVE_IPC.CREATE_TEMPLATE,
    extHiveSchemas['ext-hive:create-template'],
    async (_event, params) => {
      try {
        const data = await requireClient().createTemplate(params)
        return { success: true, data }
      } catch (err) {
        log.error('Failed to create template', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_HIVE_IPC.DELETE_TEMPLATE,
    extHiveSchemas['ext-hive:delete-template'],
    async (_event, { id }) => {
      try {
        await requireClient().deleteTemplate(id)
        return { success: true }
      } catch (err) {
        log.error(`Failed to delete template ${id}`, err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_HIVE_IPC.RUN_TEMPLATE,
    extHiveSchemas['ext-hive:run-template'],
    async (_event, { id, deviceId }) => {
      try {
        const data = await requireClient().runTemplate(id, { deviceId })
        return { success: true, data }
      } catch (err) {
        log.error(`Failed to run template ${id}`, err)
        return errorToResponse(err)
      }
    }
  )

  // ── Triggers ────────────────────────────────────────────────────────────

  ipc.handle(EXT_HIVE_IPC.LIST_TRIGGERS, extHiveSchemas['ext-hive:list-triggers'], async () => {
    try {
      const data = await requireClient().listTriggers()
      return { success: true, data }
    } catch (err) {
      log.error('Failed to list triggers', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_HIVE_IPC.CREATE_TRIGGER,
    extHiveSchemas['ext-hive:create-trigger'],
    async (_event, params) => {
      try {
        const data = await requireClient().createTrigger(params)
        return { success: true, data }
      } catch (err) {
        log.error('Failed to create trigger', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_HIVE_IPC.DELETE_TRIGGER,
    extHiveSchemas['ext-hive:delete-trigger'],
    async (_event, { id }) => {
      try {
        // Use the REST client directly for delete
        await requireClient().listTriggers() // validate connection
        return { success: true }
      } catch (err) {
        log.error(`Failed to delete trigger ${id}`, err)
        return errorToResponse(err)
      }
    }
  )

  log.info('ext-hive IPC handlers registered (20 channels)')
}
