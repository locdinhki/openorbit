// ============================================================================
// ext-voip — VoIP Service (Twilio Voice Integration)
// ============================================================================

import type { Database } from 'better-sqlite3'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { createLogger } from '@openorbit/core/utils/logger'
import { VoipCallsRepo, type VoipCall, type VoipRecording } from './db/calls-repo'

const log = createLogger('ext:voip:service')

// Twilio type definitions (dynamic import)
interface TwilioCallInstance {
  sid: string
  status: string
  to: string
  from: string
  duration: string
  startTime: Date
  endTime: Date
  answeredBy: string
  price: string
  priceUnit: string
}

interface TwilioRecordingInstance {
  sid: string
  callSid: string
  duration: string
  status: string
  uri: string
}

export interface VoipServiceConfig {
  accountSid: string
  authToken: string
  phoneNumber: string
  recordingEnabled: boolean
  transcriptionEnabled: boolean
}

export interface StartCallOptions {
  to: string
  from?: string
  contactId?: string
  contactName?: string
  record?: boolean
}

export interface CallResult {
  success: boolean
  call?: VoipCall
  error?: string
}

export interface RecordingResult {
  success: boolean
  recording?: VoipRecording
  error?: string
}

export class VoipService {
  private repo: VoipCallsRepo
  private settings: SettingsRepo
  private twilioClient: unknown | null = null

  constructor(db: Database) {
    this.repo = new VoipCallsRepo(db)
    this.settings = new SettingsRepo()
  }

  /**
   * Get VoIP configuration from settings.
   */
  getConfig(): VoipServiceConfig | null {
    const accountSid = this.settings.get('voip.twilio-account-sid') as string | null
    const authToken = this.settings.get('voip.twilio-auth-token') as string | null
    const phoneNumber = this.settings.get('voip.twilio-phone-number') as string | null

    if (!accountSid || !authToken || !phoneNumber) {
      return null
    }

    return {
      accountSid,
      authToken,
      phoneNumber,
      recordingEnabled: this.settings.get('voip.recording-enabled') === 'true',
      transcriptionEnabled: this.settings.get('voip.transcription-enabled') === 'true'
    }
  }

  /**
   * Test Twilio connection.
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    const config = this.getConfig()
    if (!config) {
      return {
        success: false,
        error: 'VoIP not configured. Please set Twilio credentials in settings.'
      }
    }

    try {
      const twilio = await this.getTwilioClient()
      if (!twilio) {
        return { success: false, error: 'Failed to initialize Twilio client' }
      }

      // Verify account by fetching account info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const account = await (twilio as any).api.accounts(config.accountSid).fetch()
      log.info(`Twilio connection verified: ${account.friendlyName}`)

      return { success: true }
    } catch (err) {
      const error = err as Error
      log.error('Twilio connection test failed', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Start an outbound call.
   */
  async startCall(options: StartCallOptions): Promise<CallResult> {
    const config = this.getConfig()
    if (!config) {
      return { success: false, error: 'VoIP not configured' }
    }

    const from = options.from ?? config.phoneNumber
    const shouldRecord = options.record ?? config.recordingEnabled

    // Create local call record first
    const call = this.repo.createCall({
      fromNumber: from,
      toNumber: options.to,
      contactId: options.contactId,
      contactName: options.contactName,
      direction: 'outbound'
    })

    try {
      const twilio = await this.getTwilioClient()
      if (!twilio) {
        this.repo.updateCall(call.id, { status: 'failed' })
        return { success: false, error: 'Failed to initialize Twilio client' }
      }

      // Note: In a real implementation, you'd need a webhook URL to receive call status updates.
      // This is a simplified version that initiates the call.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const twilioCall = (await (twilio as any).calls.create({
        to: options.to,
        from,
        record: shouldRecord,
        // In production, you'd set a TwiML URL or inline TwiML
        twiml:
          '<Response><Say>This call is being placed by OpenOrbit.</Say><Dial>' +
          options.to +
          '</Dial></Response>'
      })) as TwilioCallInstance

      // Update call with Twilio SID
      const updatedCall = this.repo.updateCall(call.id, {
        twilioSid: twilioCall.sid,
        status: 'ringing'
      })

      log.info(`Call initiated: ${call.id} (Twilio SID: ${twilioCall.sid})`)

      return { success: true, call: updatedCall ?? call }
    } catch (err) {
      const error = err as Error
      log.error('Failed to start call', error)
      this.repo.updateCall(call.id, { status: 'failed' })
      return { success: false, error: error.message }
    }
  }

  /**
   * End an active call.
   */
  async endCall(callId: string): Promise<CallResult> {
    const call = this.repo.getCall(callId)
    if (!call) {
      return { success: false, error: 'Call not found' }
    }

    if (!call.twilio_sid) {
      // Local-only call, just update status
      const updatedCall = this.repo.updateCall(callId, {
        status: 'completed',
        endTime: new Date().toISOString()
      })
      return { success: true, call: updatedCall ?? call }
    }

    try {
      const twilio = await this.getTwilioClient()
      if (!twilio) {
        return { success: false, error: 'Failed to initialize Twilio client' }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (twilio as any).calls(call.twilio_sid).update({ status: 'completed' })

      const updatedCall = this.repo.updateCall(callId, {
        status: 'completed',
        endTime: new Date().toISOString()
      })

      log.info(`Call ended: ${callId}`)

      return { success: true, call: updatedCall ?? call }
    } catch (err) {
      const error = err as Error
      log.error('Failed to end call', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get call status from Twilio and sync local record.
   */
  async syncCallStatus(callId: string): Promise<CallResult> {
    const call = this.repo.getCall(callId)
    if (!call) {
      return { success: false, error: 'Call not found' }
    }

    if (!call.twilio_sid) {
      return { success: true, call }
    }

    try {
      const twilio = await this.getTwilioClient()
      if (!twilio) {
        return { success: false, error: 'Failed to initialize Twilio client' }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const twilioCall = (await (twilio as any)
        .calls(call.twilio_sid)
        .fetch()) as TwilioCallInstance

      const updatedCall = this.repo.updateCall(callId, {
        status: this.mapTwilioStatus(twilioCall.status),
        durationSeconds: parseInt(twilioCall.duration, 10) || 0,
        endTime: twilioCall.endTime?.toISOString(),
        answeredAt: twilioCall.answeredBy ? twilioCall.startTime?.toISOString() : undefined,
        price: twilioCall.price,
        priceUnit: twilioCall.priceUnit
      })

      return { success: true, call: updatedCall ?? call }
    } catch (err) {
      const error = err as Error
      log.error('Failed to sync call status', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Start recording for an active call.
   */
  async startRecording(callId: string): Promise<RecordingResult> {
    const call = this.repo.getCall(callId)
    if (!call) {
      return { success: false, error: 'Call not found' }
    }

    if (!call.twilio_sid) {
      return { success: false, error: 'Cannot record a call without Twilio SID' }
    }

    // Create local recording record
    const recording = this.repo.createRecording({ callId })

    try {
      const twilio = await this.getTwilioClient()
      if (!twilio) {
        this.repo.updateRecording(recording.id, { status: 'failed' })
        return { success: false, error: 'Failed to initialize Twilio client' }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const twilioRecording = (await (twilio as any)
        .calls(call.twilio_sid)
        .recordings.create()) as TwilioRecordingInstance

      const updatedRecording = this.repo.updateRecording(recording.id, {
        twilioSid: twilioRecording.sid
      })

      log.info(`Recording started: ${recording.id} (Twilio SID: ${twilioRecording.sid})`)

      return { success: true, recording: updatedRecording ?? recording }
    } catch (err) {
      const error = err as Error
      log.error('Failed to start recording', error)
      this.repo.updateRecording(recording.id, { status: 'failed' })
      return { success: false, error: error.message }
    }
  }

  /**
   * Stop recording for an active call.
   */
  async stopRecording(callId: string): Promise<RecordingResult> {
    const recording = this.repo.getRecordingByCallId(callId)
    if (!recording) {
      return { success: false, error: 'No active recording found for this call' }
    }

    if (!recording.twilio_sid) {
      const updatedRecording = this.repo.updateRecording(recording.id, { status: 'completed' })
      return { success: true, recording: updatedRecording ?? recording }
    }

    const call = this.repo.getCall(callId)
    if (!call?.twilio_sid) {
      return { success: false, error: 'Call not found or missing Twilio SID' }
    }

    try {
      const twilio = await this.getTwilioClient()
      if (!twilio) {
        return { success: false, error: 'Failed to initialize Twilio client' }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const twilioRecording = (await (twilio as any)
        .calls(call.twilio_sid)
        .recordings(recording.twilio_sid)
        .update({ status: 'stopped' })) as TwilioRecordingInstance

      const updatedRecording = this.repo.updateRecording(recording.id, {
        status: 'completed',
        durationSeconds: parseInt(twilioRecording.duration, 10) || 0,
        recordingUrl: `https://api.twilio.com${twilioRecording.uri.replace('.json', '.mp3')}`
      })

      log.info(`Recording stopped: ${recording.id}`)

      return { success: true, recording: updatedRecording ?? recording }
    } catch (err) {
      const error = err as Error
      log.error('Failed to stop recording', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Transcribe a recording using the AI provider.
   */
  async transcribeRecording(
    recordingId: string,
    aiService: {
      executeSkill: (
        id: string,
        input: Record<string, unknown>
      ) => Promise<{ success: boolean; data?: unknown; error?: string }>
    }
  ): Promise<RecordingResult> {
    const recording = this.repo.getRecording(recordingId)
    if (!recording) {
      return { success: false, error: 'Recording not found' }
    }

    if (!recording.recording_url) {
      return { success: false, error: 'Recording has no audio URL' }
    }

    // Mark as processing
    this.repo.updateRecording(recordingId, { transcriptStatus: 'processing' })

    try {
      const startTime = Date.now()

      // Use the voice-transcribe skill
      const result = await aiService.executeSkill('voice-transcribe', {
        audioPath: recording.recording_url
      })

      if (!result.success) {
        this.repo.updateRecording(recordingId, { transcriptStatus: 'failed' })
        return { success: false, error: result.error ?? 'Transcription failed' }
      }

      const data = result.data as { transcript: string; model?: string }
      const durationMs = Date.now() - startTime

      const updatedRecording = this.repo.updateRecording(recordingId, {
        transcript: data.transcript,
        transcriptStatus: 'completed',
        transcriptModel: data.model,
        transcriptDurationMs: durationMs
      })

      log.info(`Recording transcribed: ${recordingId} (${durationMs}ms)`)

      return { success: true, recording: updatedRecording ?? recording }
    } catch (err) {
      const error = err as Error
      log.error('Failed to transcribe recording', error)
      this.repo.updateRecording(recordingId, { transcriptStatus: 'failed' })
      return { success: false, error: error.message }
    }
  }

  // -------------------------------------------------------------------------
  // Repository passthrough methods
  // -------------------------------------------------------------------------

  getCall(id: string): VoipCall | null {
    return this.repo.getCall(id)
  }

  listCalls(options: Parameters<VoipCallsRepo['listCalls']>[0]): VoipCall[] {
    return this.repo.listCalls(options)
  }

  deleteCall(id: string): boolean {
    return this.repo.deleteCall(id)
  }

  getRecording(id: string): VoipRecording | null {
    return this.repo.getRecording(id)
  }

  listRecordings(options: Parameters<VoipCallsRepo['listRecordings']>[0]): VoipRecording[] {
    return this.repo.listRecordings(options)
  }

  deleteRecording(id: string): boolean {
    return this.repo.deleteRecording(id)
  }

  getAnalyticsSummary(
    options: Parameters<VoipCallsRepo['getAnalyticsSummary']>[0]
  ): ReturnType<VoipCallsRepo['getAnalyticsSummary']> {
    return this.repo.getAnalyticsSummary(options)
  }

  getAnalyticsByContact(contactId: string): ReturnType<VoipCallsRepo['getAnalyticsByContact']> {
    return this.repo.getAnalyticsByContact(contactId)
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async getTwilioClient(): Promise<unknown | null> {
    if (this.twilioClient) {
      return this.twilioClient
    }

    const config = this.getConfig()
    if (!config) {
      return null
    }

    try {
      const twilio = await import('twilio')
      this.twilioClient = twilio.default(config.accountSid, config.authToken)
      return this.twilioClient
    } catch {
      log.error('Failed to import twilio package. Run: npm install twilio')
      return null
    }
  }

  private mapTwilioStatus(status: string): VoipCall['status'] {
    const statusMap: Record<string, VoipCall['status']> = {
      queued: 'initiated',
      ringing: 'ringing',
      'in-progress': 'in-progress',
      completed: 'completed',
      failed: 'failed',
      busy: 'busy',
      'no-answer': 'no-answer',
      canceled: 'canceled'
    }
    return statusMap[status] ?? 'initiated'
  }
}
