// ============================================================================
// ext-stripe — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { registerExtStripeHandlers } from './ipc-handlers'
import { extStripeMigrations } from './db/migrations'

const log = createLogger('ext:stripe')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-stripe: activating (storagePath=${context.storagePath})`)

    registerExtStripeHandlers(context)

    log.info('ext-stripe: activated — 16 IPC handlers registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-stripe: deactivating')
  },

  migrations: extStripeMigrations
}

export default extension
