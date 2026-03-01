// ============================================================================
// ext-bookkeeping — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { registerExtBookkeepingHandlers } from './ipc-handlers'
import { extBookkeepingMigrations } from './db/migrations'

const log = createLogger('ext:bookkeeping')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-bookkeeping: activating (storagePath=${context.storagePath})`)

    registerExtBookkeepingHandlers(context)

    log.info('ext-bookkeeping: activated — 24 IPC handlers registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-bookkeeping: deactivating')
  },

  migrations: extBookkeepingMigrations
}

export default extension
