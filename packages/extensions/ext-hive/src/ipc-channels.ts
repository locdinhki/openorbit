// ============================================================================
// ext-hive — IPC Channel Constants
//
// All channels prefixed with "ext-hive:" and match /^[a-z-]+:[a-z-]+$/
// ============================================================================

export const EXT_HIVE_IPC = {
  // Devices
  LIST_DEVICES: 'ext-hive:list-devices',
  GET_DEVICE: 'ext-hive:get-device',

  // Tasks
  DISPATCH_TASK: 'ext-hive:dispatch-task',
  GET_TASK: 'ext-hive:get-task',
  LIST_TASKS: 'ext-hive:list-tasks',

  // Health
  HEALTH: 'ext-hive:health',

  // Schedules
  LIST_SCHEDULES: 'ext-hive:list-schedules',
  CREATE_SCHEDULE: 'ext-hive:create-schedule',
  UPDATE_SCHEDULE: 'ext-hive:update-schedule',
  DELETE_SCHEDULE: 'ext-hive:delete-schedule',

  // Chat
  CHAT_SEND: 'ext-hive:chat-send',
  CHAT_CLEAR: 'ext-hive:chat-clear'
} as const

export type ExtHiveIPCChannel = (typeof EXT_HIVE_IPC)[keyof typeof EXT_HIVE_IPC]
