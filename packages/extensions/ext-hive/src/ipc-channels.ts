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
  CHAT_CLEAR: 'ext-hive:chat-clear',

  // Terminal
  OPEN_TERMINAL: 'ext-hive:open-terminal',

  // Templates
  LIST_TEMPLATES: 'ext-hive:list-templates',
  CREATE_TEMPLATE: 'ext-hive:create-template',
  DELETE_TEMPLATE: 'ext-hive:delete-template',
  RUN_TEMPLATE: 'ext-hive:run-template',

  // Triggers
  LIST_TRIGGERS: 'ext-hive:list-triggers',
  CREATE_TRIGGER: 'ext-hive:create-trigger',
  DELETE_TRIGGER: 'ext-hive:delete-trigger',

  // Health Checks
  LIST_HEALTH_CHECKS: 'ext-hive:list-health-checks',
  CREATE_HEALTH_CHECK: 'ext-hive:create-health-check',

  // Fleet Reports
  GENERATE_REPORT: 'ext-hive:generate-report',
  GET_LATEST_REPORT: 'ext-hive:get-latest-report'
} as const

export type ExtHiveIPCChannel = (typeof EXT_HIVE_IPC)[keyof typeof EXT_HIVE_IPC]
