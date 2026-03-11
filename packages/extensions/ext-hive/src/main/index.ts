// ============================================================================
// ext-hive — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { registerExtHiveHandlers } from './ipc-handlers'
import { HiveClient } from './hive-client'
import { HiveChatHandler } from './ai/hive-chat-handler'
import { createHiveExecSkill } from './skills/hive-exec-skill'
import { createHiveReadSkill } from './skills/hive-read-skill'
import { createHiveWriteSkill } from './skills/hive-write-skill'
import { createHiveHttpSkill } from './skills/hive-http-skill'
import { createHiveListDevicesSkill } from './skills/hive-list-devices-skill'

const log = createLogger('ext:hive')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-hive: activating (storagePath=${context.storagePath})`)

    // HiveClient — created from settings, accessed via getter
    let client: HiveClient | null = null

    function rebuildClient(): void {
      const url = context.services.settings.get('hive.url') as string | undefined
      const apiKey = context.services.settings.get('hive.api-key') as string | undefined
      if (url && apiKey) {
        client = new HiveClient(url.replace(/\/+$/, ''), apiKey)
        log.info(`ext-hive: client configured for ${url}`)
      } else {
        client = null
        log.info('ext-hive: not configured (missing hive.url or hive.api-key)')
      }
    }

    rebuildClient()

    // Rebuild client when settings change
    context.events.on('settings-changed', () => {
      rebuildClient()
    })

    const getClient = (): HiveClient | null => client

    // Chat handler — lazy init on first use
    let chatHandler: HiveChatHandler | null = null
    const getChatHandler = (): HiveChatHandler | null => {
      if (!chatHandler && context.services.ai) {
        chatHandler = new HiveChatHandler(context.services.ai, getClient, context.services.skills)
        log.info('ext-hive: chat handler initialized')
      }
      return chatHandler
    }

    // Register IPC handlers (including chat)
    registerExtHiveHandlers(context, getClient, getChatHandler)

    // Register skills
    const skills = context.services.skills
    skills.registerSkill(createHiveExecSkill(getClient))
    skills.registerSkill(createHiveReadSkill(getClient))
    skills.registerSkill(createHiveWriteSkill(getClient))
    skills.registerSkill(createHiveHttpSkill(getClient))
    skills.registerSkill(createHiveListDevicesSkill(getClient))

    log.info('ext-hive: activated — 8 IPC handlers, 5 skills registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-hive: deactivating')
  }
}

export default extension
