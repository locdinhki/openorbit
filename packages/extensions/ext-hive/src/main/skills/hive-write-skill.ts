// ============================================================================
// ext-hive — hive-write skill
// ============================================================================

import type { Skill, SkillResult } from '@openorbit/core/skills/skill-types'
import type { HiveClient } from '../hive-client'
import { dispatchAndPoll } from './poll-task'

export function createHiveWriteSkill(getClient: () => HiveClient | null): Skill {
  return {
    id: 'hive-write',
    displayName: 'Hive: Write File',
    description: 'Write a file on a remote minion device.',
    category: 'utility',
    extensionId: 'ext-hive',
    icon: 'file-edit',
    capabilities: { aiTool: true, offlineCapable: false },
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Target device ID' },
        path: { type: 'string', description: 'Absolute file path to write' },
        content: { type: 'string', description: 'File content to write' }
      },
      required: ['device', 'path', 'content']
    },
    outputSchema: {
      type: 'object',
      description: 'Write result',
      properties: {
        bytesWritten: { type: 'number' }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const client = getClient()
      if (!client) return { success: false, error: 'Hive not configured' }

      const device = input.device as string
      const path = input.path as string
      const content = input.content as string
      if (!device || !path || content === undefined) {
        return { success: false, error: 'device, path, and content required' }
      }

      try {
        const task = await dispatchAndPoll(client, device, { type: 'write', path, content })

        if (task.status === 'failed' || task.status === 'timeout') {
          return { success: false, error: task.results?.[0]?.error ?? `Task ${task.status}` }
        }

        const result = task.results?.[0]?.result as Record<string, unknown> | undefined
        return {
          success: true,
          data: { bytesWritten: result?.bytesWritten ?? 0 },
          summary: `Wrote ${path} on ${device}`
        }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  }
}
