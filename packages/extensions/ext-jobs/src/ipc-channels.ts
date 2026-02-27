// ============================================================================
// ext-jobs — IPC Channel Constants
//
// All channels are prefixed with "ext-jobs:" and match /^[a-z-]+:[a-z-]+$/
// ============================================================================

export const EXT_JOBS_IPC = {
  // Jobs
  LIST: 'ext-jobs:list',
  UPDATE: 'ext-jobs:update',
  APPROVE: 'ext-jobs:approve',
  REJECT: 'ext-jobs:reject',
  DELETE: 'ext-jobs:delete',
  REFETCH: 'ext-jobs:refetch',

  // Profiles
  PROFILES_LIST: 'ext-jobs:profiles-list',
  PROFILES_CREATE: 'ext-jobs:profiles-create',
  PROFILES_UPDATE: 'ext-jobs:profiles-update',
  PROFILES_DELETE: 'ext-jobs:profiles-delete',

  // Automation
  AUTOMATION_START: 'ext-jobs:automation-start',
  AUTOMATION_STOP: 'ext-jobs:automation-stop',
  AUTOMATION_PAUSE: 'ext-jobs:automation-pause',
  AUTOMATION_STATUS: 'ext-jobs:automation-status',

  // Chat
  CHAT_SEND: 'ext-jobs:chat-send',
  CHAT_ANALYZE_JOB: 'ext-jobs:chat-analyze',

  // Application
  APPLICATION_START: 'ext-jobs:application-start',
  APPLICATION_ANSWER: 'ext-jobs:application-answer',

  // Action Log
  ACTION_LOG_LIST: 'ext-jobs:action-log-list',

  // Memory
  MEMORY_SEARCH: 'ext-jobs:memory-search',
  MEMORY_ADD: 'ext-jobs:memory-add',
  MEMORY_DELETE: 'ext-jobs:memory-delete',
  MEMORY_LIST: 'ext-jobs:memory-list',

  // Sessions
  SESSIONS_LIST: 'ext-jobs:sessions-list',
  SESSIONS_CREATE: 'ext-jobs:sessions-create',
  SESSIONS_LOAD: 'ext-jobs:sessions-load',
  SESSIONS_DELETE: 'ext-jobs:sessions-delete',
  SESSIONS_RENAME: 'ext-jobs:sessions-rename',
  CHAT_CLEAR: 'ext-jobs:chat-clear',

  // Push events (main → renderer)
  AUTOMATION_STATUS_PUSH: 'ext-jobs:automation-status-push',
  JOBS_NEW: 'ext-jobs:jobs-new',
  APPLICATION_PROGRESS: 'ext-jobs:application-progress',
  APPLICATION_PAUSE_QUESTION: 'ext-jobs:application-pause',
  APPLICATION_COMPLETE: 'ext-jobs:application-complete'
} as const

export type ExtJobsIPCChannel = (typeof EXT_JOBS_IPC)[keyof typeof EXT_JOBS_IPC]
