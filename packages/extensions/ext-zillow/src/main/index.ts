// ============================================================================
// ext-zillow — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { registerExtZillowHandlers } from './ipc-handlers'
import { extZillowMigrations } from './db/migrations'

const log = createLogger('ext:zillow')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-zillow: activating (storagePath=${context.storagePath})`)

    registerExtZillowHandlers(context)

    log.info('ext-zillow: activated — 5 IPC handlers registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-zillow: deactivating')
  },

  migrations: extZillowMigrations
}

export default extension
