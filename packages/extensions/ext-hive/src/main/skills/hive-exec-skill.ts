// ============================================================================
// ext-hive — hive-exec skill
// ============================================================================

import type { Skill, SkillResult } from '@openorbit/core/skills/skill-types'
import type { HiveClient } from '../hive-client'
import { dispatchAndPoll } from './poll-task'

export function createHiveExecSkill(getClient: () => HiveClient | null): Skill {
  return {
    id: 'hive-exec',
    displayName: 'Hive: Execute Command',
    description:
      'Execute a shell command on a remote minion device. Returns stdout, stderr, and exit code.',
    category: 'utility',
    extensionId: 'ext-hive',
    icon: 'terminal',
    capabilities: { aiTool: true, offlineCapable: false },
    inputSchema: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'Target device ID (e.g. "pi-01")' },
        command: { type: 'string', description: 'Shell command to execute' },
        cwd: { type: 'string', description: 'Working directory (optional)' },
        timeout: { type: 'number', description: 'Timeout in ms (default 60000)' }
      },
      required: ['device', 'command']
    },
    outputSchema: {
      type: 'object',
      description: 'Command execution result',
      properties: {
        exitCode: { type: 'number' },
        stdout: { type: 'string' },
        stderr: { type: 'string' },
        durationMs: { type: 'number' }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const client = getClient()
      if (!client) return { success: false, error: 'Hive not configured' }

      const device = input.device as string
      const command = input.command as string
      if (!device || !command) return { success: false, error: 'device and command required' }

      try {
        const task = await dispatchAndPoll(client, device, {
          type: 'exec',
          command,
          cwd: input.cwd as string | undefined,
          timeout: input.timeout as number | undefined
        })

        if (task.status === 'failed' || task.status === 'timeout') {
          const err = task.results?.[0]?.error ?? `Task ${task.status}`
          return { success: false, error: err }
        }

        const result = task.results?.[0]?.result as Record<string, unknown> | undefined
        return {
          success: true,
          data: result ?? {},
          summary: `Executed on ${device}: exit ${result?.exitCode ?? '?'}`
        }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  }
}
