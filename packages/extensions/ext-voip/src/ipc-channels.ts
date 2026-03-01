// ============================================================================
// ext-voip — IPC Channel Constants
//
// All channels are prefixed with "ext-voip:" and match /^[a-z-]+:[a-z-]+$/
// ============================================================================

export const EXT_VOIP_IPC = {
  // Settings
  SETTINGS_GET: 'ext-voip:settings-get',
  SETTINGS_SET: 'ext-voip:settings-set',
  CONNECTION_TEST: 'ext-voip:connection-test',

  // Calls
  CALL_START: 'ext-voip:call-start',
  CALL_END: 'ext-voip:call-end',
  CALL_STATUS: 'ext-voip:call-status',
  CALLS_LIST: 'ext-voip:calls-list',
  CALL_GET: 'ext-voip:call-get',
  CALL_DELETE: 'ext-voip:call-delete',

  // Recordings
  RECORDING_START: 'ext-voip:recording-start',
  RECORDING_STOP: 'ext-voip:recording-stop',
  RECORDING_GET: 'ext-voip:recording-get',
  RECORDING_DELETE: 'ext-voip:recording-delete',
  RECORDINGS_LIST: 'ext-voip:recordings-list',

  // Transcription
  TRANSCRIPTION_START: 'ext-voip:transcription-start',
  TRANSCRIPTION_GET: 'ext-voip:transcription-get',
  TRANSCRIPTION_STATUS: 'ext-voip:transcription-status',

  // Analytics
  ANALYTICS_SUMMARY: 'ext-voip:analytics-summary',
  ANALYTICS_BY_CONTACT: 'ext-voip:analytics-by-contact',

  // Push events (main → renderer)
  CALL_STATE_CHANGED: 'ext-voip:call-state-changed',
  RECORDING_PROGRESS: 'ext-voip:recording-progress',
  TRANSCRIPTION_COMPLETE: 'ext-voip:transcription-complete'
} as const

export type ExtVoipIPCChannel = (typeof EXT_VOIP_IPC)[keyof typeof EXT_VOIP_IPC]
