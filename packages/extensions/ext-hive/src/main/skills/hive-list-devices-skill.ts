// ============================================================================
// ext-hive — hive-list-devices skill
// ============================================================================

import type { Skill, SkillResult } from '@openorbit/core/skills/skill-types'
import type { HiveClient } from '../hive-client'

export function createHiveListDevicesSkill(getClient: () => HiveClient | null): Skill {
  return {
    id: 'hive-list-devices',
    displayName: 'Hive: List Devices',
    description:
      'List all registered minion devices and their status. Use this to discover available devices before dispatching tasks.',
    category: 'utility',
    extensionId: 'ext-hive',
    icon: 'server',
    capabilities: { aiTool: true, offlineCapable: false },
    inputSchema: {
      type: 'object',
      properties: {}
    },
    outputSchema: {
      type: 'object',
      description: 'Device list',
      properties: {
        devices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              status: { type: 'string' },
              type: { type: 'string' },
              arch: { type: 'string' },
              cores: { type: 'number' },
              ramMb: { type: 'number' }
            }
          }
        }
      }
    },

    async execute(): Promise<SkillResult> {
      const client = getClient()
      if (!client) return { success: false, error: 'Hive not configured' }

      try {
        const allDevices = await client.listDevices()
        const summary = allDevices.map((d) => {
          const hw = d.hardwareInfo as Record<string, unknown> | null
          const cpu = hw?.cpu as Record<string, unknown> | undefined
          const mem = hw?.memory as Record<string, unknown> | undefined
          return {
            id: d.id,
            name: d.name,
            status: d.status,
            type: d.type,
            arch: (hw?.arch as string) ?? 'unknown',
            cores: (cpu?.cores as number) ?? 0,
            ramMb: (mem?.totalMb as number) ?? 0
          }
        })

        const online = summary.filter((d) => d.status === 'online').length
        return {
          success: true,
          data: { devices: summary },
          summary: `${summary.length} devices (${online} online)`
        }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  }
}
