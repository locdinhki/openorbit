// ============================================================================
// ext-docs — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { registerExtDocsHandlers } from './ipc-handlers'
import { extDocsMigrations } from './db/migrations'

const log = createLogger('ext:docs')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-docs: activating (storagePath=${context.storagePath})`)

    registerExtDocsHandlers(context)

    log.info('ext-docs: activated — IPC handlers registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-docs: deactivating')
  },

  migrations: extDocsMigrations
}

export default extension
