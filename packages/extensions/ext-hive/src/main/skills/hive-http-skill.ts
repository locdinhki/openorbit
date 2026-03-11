// ============================================================================
// ext-hive — hive-http skill
// ============================================================================

import type { Skill, SkillResult } from '@openorbit/core/skills/skill-types'
import type { HiveClient } from '../hive-client'
import { dispatchAndPoll } from './poll-task'

export function createHiveHttpSkill(getClient: () => HiveClient | null): Skill {
  return {
    id: 'hive-http',
    displayName: 'Hive: HTTP Request',
    description: 'Make an HTTP request from a remote minion device (different IP/network).',
    category: 'utility',
    extensionId: 'ext-hive',
    icon: 'globe',
    capabilities: { aiTool: true, offlineCapable: false },
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Target device ID' },
        method: { type: 'string', description: 'HTTP method (GET, POST, etc.)' },
        url: { type: 'string', description: 'Request URL' },
        headers: { type: 'object', description: 'Request headers (optional)' },
        body: { type: 'string', description: 'Request body (optional)' }
      },
      required: ['device', 'method', 'url']
    },
    outputSchema: {
      type: 'object',
      description: 'HTTP response',
      properties: {
        status: { type: 'number' },
        headers: { type: 'object' },
        body: { type: 'string' }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const client = getClient()
      if (!client) return { success: false, error: 'Hive not configured' }

      const device = input.device as string
      const method = input.method as string
      const url = input.url as string
      if (!device || !method || !url) {
        return { success: false, error: 'device, method, and url required' }
      }

      try {
        const task = await dispatchAndPoll(client, device, {
          type: 'http',
          method,
          url,
          headers: input.headers as Record<string, string> | undefined,
          body: input.body as string | undefined
        })

        if (task.status === 'failed' || task.status === 'timeout') {
          return { success: false, error: task.results?.[0]?.error ?? `Task ${task.status}` }
        }

        const result = task.results?.[0]?.result as Record<string, unknown> | undefined
        return {
          success: true,
          data: result ?? {},
          summary: `${method} ${url} from ${device}: ${result?.status ?? '?'}`
        }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  }
}
