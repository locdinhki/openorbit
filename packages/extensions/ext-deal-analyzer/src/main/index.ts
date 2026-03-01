// ============================================================================
// ext-deal-analyzer — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { registerDealAnalyzerHandlers } from './ipc-handlers'
import { extDealAnalyzerMigrations } from './db/migrations'
import { createDealAnalyzerSkills } from './ai/deal-tools'

const log = createLogger('ext:deal-analyzer')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-deal-analyzer: activating (storagePath=${context.storagePath})`)

    // Register IPC handlers
    registerDealAnalyzerHandlers(context)

    // Register AI-accessible skills
    const skills = createDealAnalyzerSkills(context)
    for (const skill of skills) {
      context.services.skills.registerSkill(skill)
    }

    log.info(
      `ext-deal-analyzer: activated — 14 IPC handlers, ${skills.length} AI skills registered`
    )
  },

  async deactivate(): Promise<void> {
    log.info('ext-deal-analyzer: deactivating')
  },

  migrations: extDealAnalyzerMigrations
}

export default extension
