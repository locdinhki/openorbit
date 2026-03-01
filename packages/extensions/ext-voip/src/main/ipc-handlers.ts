// ============================================================================
// ext-voip — IPC Handlers
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { createLogger } from '@openorbit/core/utils/logger'
import { EXT_VOIP_IPC } from '../ipc-channels'
import { extVoipSchemas } from '../ipc-schemas'
import { VoipService } from './voip-service'

const log = createLogger('ext:voip:ipc')

export function registerExtVoipHandlers(context: ExtensionContext): void {
  const { ipc, db } = context
  const service = new VoipService(db)
  const settings = new SettingsRepo()

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  ipc.handle(EXT_VOIP_IPC.SETTINGS_GET, extVoipSchemas['ext-voip:settings-get'], () => {
    return {
      success: true,
      data: {
        accountSid: settings.get('voip.twilio-account-sid') ?? '',
        authToken: settings.get('voip.twilio-auth-token') ? '••••••••' : '',
        phoneNumber: settings.get('voip.twilio-phone-number') ?? '',
        recordingEnabled: settings.get('voip.recording-enabled') === 'true',
        transcriptionEnabled: settings.get('voip.transcription-enabled') === 'true',
        isConfigured:
          !!settings.get('voip.twilio-account-sid') && !!settings.get('voip.twilio-auth-token')
      }
    }
  })

  ipc.handle(
    EXT_VOIP_IPC.SETTINGS_SET,
    extVoipSchemas['ext-voip:settings-set'],
    (_event, { accountSid, authToken, phoneNumber, recordingEnabled, transcriptionEnabled }) => {
      if (accountSid !== undefined) settings.set('voip.twilio-account-sid', accountSid)
      if (authToken !== undefined) settings.set('voip.twilio-auth-token', authToken)
      if (phoneNumber !== undefined) settings.set('voip.twilio-phone-number', phoneNumber)
      if (recordingEnabled !== undefined)
        settings.set('voip.recording-enabled', String(recordingEnabled))
      if (transcriptionEnabled !== undefined)
        settings.set('voip.transcription-enabled', String(transcriptionEnabled))

      log.info('VoIP settings updated')
      return { success: true }
    }
  )

  ipc.handle(EXT_VOIP_IPC.CONNECTION_TEST, extVoipSchemas['ext-voip:connection-test'], async () => {
    const result = await service.testConnection()
    return result.success ? { success: true } : { success: false, error: result.error }
  })

  // -------------------------------------------------------------------------
  // Calls
  // -------------------------------------------------------------------------

  ipc.handle(
    EXT_VOIP_IPC.CALL_START,
    extVoipSchemas['ext-voip:call-start'],
    async (_event, { to, from, contactId, contactName, record }) => {
      const result = await service.startCall({ to, from, contactId, contactName, record })
      if (result.success) {
        // Notify renderer of call state change
        ipc.push(EXT_VOIP_IPC.CALL_STATE_CHANGED, {
          callId: result.call!.id,
          status: result.call!.status
        })
        return { success: true, data: result.call }
      }
      return { success: false, error: result.error }
    }
  )

  ipc.handle(
    EXT_VOIP_IPC.CALL_END,
    extVoipSchemas['ext-voip:call-end'],
    async (_event, { callId }) => {
      const result = await service.endCall(callId)
      if (result.success) {
        ipc.push(EXT_VOIP_IPC.CALL_STATE_CHANGED, {
          callId: result.call!.id,
          status: result.call!.status
        })
        return { success: true, data: result.call }
      }
      return { success: false, error: result.error }
    }
  )

  ipc.handle(
    EXT_VOIP_IPC.CALL_STATUS,
    extVoipSchemas['ext-voip:call-status'],
    async (_event, { callId }) => {
      const result = await service.syncCallStatus(callId)
      if (result.success) {
        return { success: true, data: result.call }
      }
      return { success: false, error: result.error }
    }
  )

  ipc.handle(
    EXT_VOIP_IPC.CALLS_LIST,
    extVoipSchemas['ext-voip:calls-list'],
    (_event, { limit, offset, contactId, status, startDate, endDate }) => {
      const calls = service.listCalls({ limit, offset, contactId, status, startDate, endDate })
      return { success: true, data: calls }
    }
  )

  ipc.handle(EXT_VOIP_IPC.CALL_GET, extVoipSchemas['ext-voip:call-get'], (_event, { callId }) => {
    const call = service.getCall(callId)
    if (call) {
      return { success: true, data: call }
    }
    return { success: false, error: 'Call not found' }
  })

  ipc.handle(
    EXT_VOIP_IPC.CALL_DELETE,
    extVoipSchemas['ext-voip:call-delete'],
    (_event, { callId }) => {
      const deleted = service.deleteCall(callId)
      if (deleted) {
        return { success: true }
      }
      return { success: false, error: 'Call not found or already deleted' }
    }
  )

  // -------------------------------------------------------------------------
  // Recordings
  // -------------------------------------------------------------------------

  ipc.handle(
    EXT_VOIP_IPC.RECORDING_START,
    extVoipSchemas['ext-voip:recording-start'],
    async (_event, { callId }) => {
      const result = await service.startRecording(callId)
      if (result.success) {
        return { success: true, data: result.recording }
      }
      return { success: false, error: result.error }
    }
  )

  ipc.handle(
    EXT_VOIP_IPC.RECORDING_STOP,
    extVoipSchemas['ext-voip:recording-stop'],
    async (_event, { callId }) => {
      const result = await service.stopRecording(callId)
      if (result.success) {
        return { success: true, data: result.recording }
      }
      return { success: false, error: result.error }
    }
  )

  ipc.handle(
    EXT_VOIP_IPC.RECORDING_GET,
    extVoipSchemas['ext-voip:recording-get'],
    (_event, { recordingId }) => {
      const recording = service.getRecording(recordingId)
      if (recording) {
        return { success: true, data: recording }
      }
      return { success: false, error: 'Recording not found' }
    }
  )

  ipc.handle(
    EXT_VOIP_IPC.RECORDING_DELETE,
    extVoipSchemas['ext-voip:recording-delete'],
    (_event, { recordingId }) => {
      const deleted = service.deleteRecording(recordingId)
      if (deleted) {
        return { success: true }
      }
      return { success: false, error: 'Recording not found or already deleted' }
    }
  )

  ipc.handle(
    EXT_VOIP_IPC.RECORDINGS_LIST,
    extVoipSchemas['ext-voip:recordings-list'],
    (_event, { callId, limit, offset }) => {
      const recordings = service.listRecordings({ callId, limit, offset })
      return { success: true, data: recordings }
    }
  )

  // -------------------------------------------------------------------------
  // Transcription
  // -------------------------------------------------------------------------

  ipc.handle(
    EXT_VOIP_IPC.TRANSCRIPTION_START,
    extVoipSchemas['ext-voip:transcription-start'],
    async (_event, { recordingId }) => {
      // Create a simple wrapper for the skills service
      const aiService = {
        executeSkill: async (id: string, input: Record<string, unknown>) => {
          return context.services.skills.execute(id, input)
        }
      }

      const result = await service.transcribeRecording(recordingId, aiService)
      if (result.success) {
        // Notify renderer
        ipc.push(EXT_VOIP_IPC.TRANSCRIPTION_COMPLETE, {
          recordingId,
          transcript: result.recording!.transcript
        })
        return { success: true, data: result.recording }
      }
      return { success: false, error: result.error }
    }
  )

  ipc.handle(
    EXT_VOIP_IPC.TRANSCRIPTION_GET,
    extVoipSchemas['ext-voip:transcription-get'],
    (_event, { recordingId }) => {
      const recording = service.getRecording(recordingId)
      if (recording) {
        return {
          success: true,
          data: {
            transcript: recording.transcript,
            status: recording.transcript_status,
            model: recording.transcript_model,
            durationMs: recording.transcript_duration_ms
          }
        }
      }
      return { success: false, error: 'Recording not found' }
    }
  )

  ipc.handle(
    EXT_VOIP_IPC.TRANSCRIPTION_STATUS,
    extVoipSchemas['ext-voip:transcription-status'],
    (_event, { recordingId }) => {
      const recording = service.getRecording(recordingId)
      if (recording) {
        return {
          success: true,
          data: {
            status: recording.transcript_status ?? 'not-started',
            hasTranscript: !!recording.transcript
          }
        }
      }
      return { success: false, error: 'Recording not found' }
    }
  )

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  ipc.handle(
    EXT_VOIP_IPC.ANALYTICS_SUMMARY,
    extVoipSchemas['ext-voip:analytics-summary'],
    (_event, { startDate, endDate }) => {
      const summary = service.getAnalyticsSummary({ startDate, endDate })
      return { success: true, data: summary }
    }
  )

  ipc.handle(
    EXT_VOIP_IPC.ANALYTICS_BY_CONTACT,
    extVoipSchemas['ext-voip:analytics-by-contact'],
    (_event, { contactId }) => {
      const analytics = service.getAnalyticsByContact(contactId)
      return { success: true, data: analytics }
    }
  )

  log.info('ext-voip: 20 IPC handlers registered')
}
