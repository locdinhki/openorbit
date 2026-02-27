// ============================================================================
// OpenOrbit Shell — IPC Channels (shell-only)
// Extension channels live in their own packages (e.g. ext-jobs:*)
// ============================================================================

export const IPC = {
  // Browser / Session
  SESSION_INIT: 'session:init',
  SESSION_STATUS: 'session:status',
  SESSION_LOGIN: 'session:login',
  SESSION_SAVE: 'session:save',
  SESSION_CLOSE: 'session:close',
  BROWSER_NAVIGATE: 'browser:navigate',
  BROWSER_SCREENSHOT: 'browser:screenshot',

  // Screencast (live browser view)
  SCREENCAST_START: 'screencast:start',
  SCREENCAST_STOP: 'screencast:stop',
  SCREENCAST_FRAME: 'screencast:frame',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_LOG_PATH: 'settings:log-path',

  // Updates
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_READY: 'update:ready',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',

  // Notifications (push events)
  NOTIFICATION_CLICKED: 'notification:clicked',

  // Config (push events)
  CONFIG_CHANGED: 'config:changed',

  // RPC / Pairing
  RPC_PAIRING_INFO: 'rpc:pairing-info',

  // Shell (extension system)
  SHELL_EXTENSIONS: 'shell:extensions',
  SHELL_EXT_ENABLE: 'shell:ext-enable',
  SHELL_EXT_DISABLE: 'shell:ext-disable',

  // AI Provider Registry
  AI_COMPLETE: 'ai:complete',
  AI_CHAT: 'ai:chat',
  AI_PROVIDERS: 'ai:providers',
  AI_SET_DEFAULT: 'ai:set-default',
  AI_STREAM: 'ai:stream',
  AI_STREAM_CHUNK: 'ai:stream-chunk',

  // Schedules
  SCHEDULE_LIST: 'schedule:list',
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_UPDATE: 'schedule:update',
  SCHEDULE_DELETE: 'schedule:delete',
  SCHEDULE_TOGGLE: 'schedule:toggle',
  SCHEDULE_TRIGGER: 'schedule:trigger',
  SCHEDULE_RUN_START: 'schedule:run-start',
  SCHEDULE_RUN_COMPLETE: 'schedule:run-complete',
  SCHEDULE_RUNS: 'schedule:runs',
  SCHEDULER_TOOLS: 'scheduler:tools',

  // Skills
  SKILL_LIST: 'skill:list',
  SKILL_EXECUTE: 'skill:execute',
  SKILL_INFO: 'skill:info',
  SKILL_ENABLE: 'skill:enable',
  SKILL_DISABLE: 'skill:disable'
} as const

export type IPCChannel = (typeof IPC)[keyof typeof IPC]
