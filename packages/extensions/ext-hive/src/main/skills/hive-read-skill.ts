// ============================================================================
// ext-hive — hive-read skill
// ============================================================================

import type { Skill, SkillResult } from '@openorbit/core/skills/skill-types'
import type { HiveClient } from '../hive-client'
import { dispatchAndPoll } from './poll-task'

export function createHiveReadSkill(getClient: () => HiveClient | null): Skill {
  return {
    id: 'hive-read',
    displayName: 'Hive: Read File',
    description: 'Read a file from a remote minion device.',
    category: 'utility',
    extensionId: 'ext-hive',
    icon: 'file-text',
    capabilities: { aiTool: true, offlineCapable: false },
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Target device ID' },
        path: { type: 'string', description: 'Absolute file path to read' }
      },
      required: ['device', 'path']
    },
    outputSchema: {
      type: 'object',
      description: 'File contents',
      properties: {
        content: { type: 'string' }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const client = getClient()
      if (!client) return { success: false, error: 'Hive not configured' }

      const device = input.device as string
      const path = input.path as string
      if (!device || !path) return { success: false, error: 'device and path required' }

      try {
        const task = await dispatchAndPoll(client, device, { type: 'read', path })

        if (task.status === 'failed' || task.status === 'timeout') {
          return { success: false, error: task.results?.[0]?.error ?? `Task ${task.status}` }
        }

        const result = task.results?.[0]?.result as Record<string, unknown> | undefined
        return {
          success: true,
          data: { content: result?.content ?? '' },
          summary: `Read ${path} from ${device}`
        }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  }
}
