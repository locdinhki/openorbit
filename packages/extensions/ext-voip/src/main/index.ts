// ============================================================================
// ext-voip — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { registerExtVoipHandlers } from './ipc-handlers'
import { extVoipMigrations } from './db/migrations'
import { VoipService } from './voip-service'

const log = createLogger('ext:voip')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-voip: activating (storagePath=${context.storagePath})`)

    // Register IPC handlers
    registerExtVoipHandlers(context)

    // Register scheduler task: sync call statuses
    context.services.scheduler.registerTaskType(
      'voip-sync-calls',
      async () => {
        const settings = new SettingsRepo()
        const accountSid = settings.get('voip.twilio-account-sid') as string | null
        const authToken = settings.get('voip.twilio-auth-token') as string | null

        if (!accountSid || !authToken) {
          log.warn('voip-sync-calls: skipped — not configured')
          return
        }

        const service = new VoipService(context.db)

        // Get all in-progress calls and sync their status
        const activeCalls = service.listCalls({ status: 'in-progress', limit: 100 })
        let synced = 0

        for (const call of activeCalls) {
          const result = await service.syncCallStatus(call.id)
          if (result.success) synced++
        }

        log.info(`voip-sync-calls: synced ${synced} active calls`)
      },
      {
        label: 'VoIP Call Status Sync',
        description: 'Sync active call statuses with Twilio',
        extensionId: 'ext-voip',
        configSchema: []
      }
    )

    // Register scheduler task: auto-transcribe recordings
    context.services.scheduler.registerTaskType(
      'voip-auto-transcribe',
      async () => {
        const settings = new SettingsRepo()
        const transcriptionEnabled = settings.get('voip.transcription-enabled') === 'true'

        if (!transcriptionEnabled) {
          log.info('voip-auto-transcribe: skipped — transcription disabled')
          return
        }

        const service = new VoipService(context.db)

        // Get recordings without transcripts
        const recordings = service.listRecordings({ limit: 10 })
        const pendingRecordings = recordings.filter(
          (r) =>
            r.status === 'completed' &&
            r.recording_url &&
            !r.transcript &&
            r.transcript_status !== 'processing'
        )

        if (pendingRecordings.length === 0) {
          log.info('voip-auto-transcribe: no pending recordings')
          return
        }

        const aiService = {
          executeSkill: async (id: string, input: Record<string, unknown>) => {
            return context.services.skills.execute(id, input)
          }
        }

        let transcribed = 0
        for (const recording of pendingRecordings) {
          const result = await service.transcribeRecording(recording.id, aiService)
          if (result.success) transcribed++
        }

        log.info(`voip-auto-transcribe: transcribed ${transcribed} recordings`)
        context.services.notifications.show(
          'VoIP Auto-Transcribe',
          `Transcribed ${transcribed} call recording(s)`
        )
      },
      {
        label: 'VoIP Auto-Transcribe',
        description: 'Automatically transcribe new call recordings',
        extensionId: 'ext-voip',
        configSchema: []
      }
    )

    log.info('ext-voip: activated — 20 IPC handlers + 2 scheduler tasks registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-voip: deactivating')
  },

  migrations: extVoipMigrations
}

export default extension
