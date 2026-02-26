// ============================================================================
// ext-db-viewer — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { registerExtDbViewerHandlers } from './ipc-handlers'

const log = createLogger('ext:db-viewer')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-db-viewer: activating (storagePath=${context.storagePath})`)

    registerExtDbViewerHandlers(context)

    log.info('ext-db-viewer: activated — 13 IPC handlers registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-db-viewer: deactivating')
  }
}

export default extension
