// ============================================================================
// ext-ghl — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { registerExtGhlHandlers } from './ipc-handlers'
import { extGhlMigrations } from './db/migrations'
import { BriefingGenerator } from './ai/briefing-generator'
import { GhlOpportunitiesRepo } from './db/opportunities-repo'
import { GoHighLevel } from './sdk/index'
import { ArvEnrichmentRunner } from './automation/arv-enrichment'

const log = createLogger('ext:ghl')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-ghl: activating (storagePath=${context.storagePath})`)

    registerExtGhlHandlers(context)

    // Register scheduler task: daily briefing
    context.services.scheduler.registerTaskType(
      'ghl-daily-briefing',
      async () => {
        const settings = new SettingsRepo()
        const token = settings.get('ghl.api-token') as string | null
        const locationId = settings.get('ghl.location-id') as string | null
        if (!token || !locationId) {
          log.warn('ghl-daily-briefing: skipped — not configured')
          return
        }
        const oppsRepo = new GhlOpportunitiesRepo(context.db)
        const briefing = new BriefingGenerator(
          context.services.ai,
          () => new GoHighLevel({ apiToken: token }),
          oppsRepo,
          () => locationId
        )
        const summary = await briefing.generate()
        context.services.notifications.show('GHL Daily Briefing', summary.slice(0, 200))
        log.info(`Daily briefing generated (${summary.length} chars)`)
      },
      {
        label: 'GHL Daily Briefing',
        description: 'Generate a daily CRM briefing summary',
        extensionId: 'ext-ghl',
        configSchema: []
      }
    )

    context.services.scheduler.registerTaskType(
      'ghl-arv-enrichment',
      async (config?: Record<string, unknown>) => {
        const settings = new SettingsRepo()
        const token = settings.get('ghl.api-token') as string | null
        const locationId = settings.get('ghl.location-id') as string | null
        if (!token || !locationId) {
          log.warn('ghl-arv-enrichment: skipped — not configured')
          return
        }
        await context.services.browser.ensureReady()
        const runner = new ArvEnrichmentRunner(
          () => new GoHighLevel({ apiToken: token }),
          () => locationId,
          () => context.services.browser.getSession(),
          context.db
        )
        const result = await runner.run({
          pipelineName: (config?.pipelineName as string) ?? 'Ready for SMS',
          arvFieldName: (config?.arvFieldName as string) ?? 'ARV'
        })
        context.services.notifications.show(
          'GHL ARV Enrichment',
          `Done: ${result.enriched} enriched, ${result.skipped} skipped, ${result.errors} errors`
        )
        log.info(`ARV enrichment complete: ${result.enriched}/${result.total}`)
      },
      {
        label: 'GHL ARV Enrichment',
        description: 'Scrape Zillow Zestimate for pipeline contacts, write back to GHL',
        extensionId: 'ext-ghl',
        configSchema: [
          {
            key: 'pipelineName',
            type: 'text',
            label: 'Pipeline Name',
            defaultValue: 'Ready for SMS'
          },
          { key: 'arvFieldName', type: 'text', label: 'ARV Field Name', defaultValue: 'ARV' }
        ]
      }
    )

    log.info('ext-ghl: activated — 28 IPC handlers + 2 scheduler tasks registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-ghl: deactivating')
  },

  migrations: extGhlMigrations
}

export default extension
