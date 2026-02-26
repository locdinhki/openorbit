// ============================================================================
// ext-jobs — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { registerExtJobsHandlers, getExtJobsCoordinator, cleanupExtJobs } from './ipc-handlers'
import { extJobsMigrations } from './db/migrations'

const log = createLogger('ext:jobs')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-jobs: activating (storagePath=${context.storagePath})`)

    registerExtJobsHandlers(context)

    // Register extraction handler with the core scheduler
    context.services.scheduler.registerTaskType(
      'extraction',
      async (config) => {
        // Auto-start browser session if not running (scheduled tasks run unattended)
        await context.services.browser.ensureReady()

        const coordinator = getExtJobsCoordinator(context)
        if (coordinator.isRunning()) {
          log.warn('Extraction already running, skipping scheduled run')
          return
        }
        try {
          const profileIds = config.profileIds as string[] | undefined
          if (profileIds && profileIds.length > 0) {
            for (const id of profileIds) {
              await coordinator.startProfile(id)
            }
          } else {
            await coordinator.startAll()
          }
        } finally {
          try {
            const session = context.services.browser.getSession()
            await session.close()
          } catch (err) {
            log.warn('Failed to close browser after extraction', err)
          }
        }
      },
      {
        label: 'Job Extraction',
        description: 'Search and extract job listings from configured platforms',
        extensionId: 'ext-jobs',
        configSchema: [
          {
            key: 'profileIds',
            type: 'multiselect',
            label: 'Search Profiles',
            source: 'ext-jobs:profiles-list',
            labelField: 'name',
            valueField: 'id'
          }
        ]
      }
    )

    log.info('ext-jobs: activated — IPC handlers + scheduler task registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-jobs: deactivating')
    await cleanupExtJobs()
  },

  migrations: extJobsMigrations
}

export default extension
