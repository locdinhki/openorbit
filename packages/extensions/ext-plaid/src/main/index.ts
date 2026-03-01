// ============================================================================
// ext-plaid — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { registerExtPlaidHandlers } from './ipc-handlers'
import { extPlaidMigrations } from './db/migrations'

const log = createLogger('ext:plaid')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-plaid: activating (storagePath=${context.storagePath})`)

    registerExtPlaidHandlers(context)

    log.info('ext-plaid: activated — 10 IPC handlers registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-plaid: deactivating')
  },

  migrations: extPlaidMigrations
}

export default extension
