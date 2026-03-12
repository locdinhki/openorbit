// ============================================================================
// ext-hive — AI Chat Handler (agentic tool-calling loop)
// ============================================================================

import type {
  AIService,
  AIToolCall,
  AIToolResult,
  AIMessage
} from '@openorbit/core/ai/provider-types'
import type { SkillService } from '@openorbit/core/skills/skill-types'
import {
  isSkillToolCall,
  executeSkillTool,
  getCombinedTools
} from '@openorbit/core/skills/skill-tool-dispatcher'
import { HIVE_TOOLS, HIVE_SYSTEM_PROMPT } from './hive-tools'
import type { HiveClient } from '../hive-client'
import { dispatchAndPoll } from '../skills/poll-task'

const MAX_HISTORY = 20
const MAX_TOOL_ROUNDS = 10

export class HiveChatHandler {
  private history: AIMessage[] = []

  constructor(
    private ai: AIService,
    private getClient: () => HiveClient | null,
    private skills?: SkillService
  ) {}

  async sendMessage(message: string): Promise<string> {
    this.history.push({ role: 'user', content: message })
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY)
    }

    const provider = this.ai.getProvider()
    if (provider?.capabilities.toolCalling && provider.completeWithTools) {
      return this.agenticLoop(message, { completeWithTools: provider.completeWithTools })
    }

    return this.simpleFallback(message)
  }

  private async agenticLoop(
    message: string,
    provider: {
      completeWithTools: NonNullable<
        NonNullable<ReturnType<AIService['getProvider']>>['completeWithTools']
      >
    }
  ): Promise<string> {
    let toolResults: AIToolResult[] = []
    let rounds = 0

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++

      const userMsg =
        toolResults.length > 0
          ? `${message}\n\n[Tool Results]\n${toolResults.map((r) => `${r.toolCallId}: ${r.content}`).join('\n')}`
          : message

      const tools = this.skills ? getCombinedTools(HIVE_TOOLS, this.skills) : HIVE_TOOLS

      const response = await provider.completeWithTools({
        systemPrompt: HIVE_SYSTEM_PROMPT,
        userMessage: userMsg,
        tools,
        tier: 'standard',
        task: 'hive-chat'
      })

      if (response.stopReason === 'end_turn' || response.toolCalls.length === 0) {
        this.history.push({ role: 'assistant', content: response.content })
        return response.content
      }

      toolResults = []
      for (const call of response.toolCalls) {
        const result = await this.executeTool(call)
        toolResults.push(result)
      }
    }

    const fallback =
      'I hit the tool-calling limit for this request. Here is what I gathered so far — try a more specific question to continue.'
    this.history.push({ role: 'assistant', content: fallback })
    return fallback
  }

  private async simpleFallback(_message: string): Promise<string> {
    const client = this.getClient()
    let snapshot = 'Hive not configured.'
    if (client) {
      try {
        const devices = await client.listDevices()
        const tasks = await client.listTasks({ limit: 10 })
        snapshot = [
          `Devices (${devices.length}): ${devices.map((d) => `${d.name} [${d.status}]`).join(', ') || 'none'}`,
          `Recent tasks (${tasks.length}): ${tasks.map((t) => `${t.id.slice(0, 8)} → ${t.targetDevice ?? '?'} [${t.status}]`).join(', ') || 'none'}`
        ].join('\n')
      } catch {
        snapshot = 'Could not reach hive.'
      }
    }

    const response = await this.ai.chat({
      systemPrompt: `${HIVE_SYSTEM_PROMPT}\n\nCurrent fleet state:\n${snapshot}`,
      messages: this.history,
      tier: 'standard',
      task: 'hive-chat'
    })

    this.history.push({ role: 'assistant', content: response.content })
    return response.content
  }

  private async executeTool(call: AIToolCall): Promise<AIToolResult> {
    try {
      const result = await this.dispatchTool(call.name, call.input)
      return { toolCallId: call.id, content: JSON.stringify(result) }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { toolCallId: call.id, content: `Error: ${message}`, isError: true }
    }
  }

  private async dispatchTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    // Delegate skill tool calls to the skill service
    if (isSkillToolCall(name) && this.skills) {
      const result = await executeSkillTool({ id: '', name, input }, this.skills)
      if (result.isError) throw new Error(result.content)
      return result.content
    }

    const client = this.requireClient()

    switch (name) {
      case 'list_devices':
        return client.listDevices()

      case 'get_device':
        return client.getDevice(input.deviceId as string)

      case 'exec_command':
        return this.dispatchAndWait(input.device as string, {
          type: 'exec',
          command: input.command as string,
          ...(input.cwd ? { cwd: input.cwd as string } : {}),
          timeout: (input.timeout as number) ?? 60000
        })

      case 'read_file':
        return this.dispatchAndWait(input.device as string, {
          type: 'read',
          path: input.path as string
        })

      case 'write_file':
        return this.dispatchAndWait(input.device as string, {
          type: 'write',
          path: input.path as string,
          content: input.content as string
        })

      case 'http_request':
        return this.dispatchAndWait(input.device as string, {
          type: 'http',
          method: input.method as string,
          url: input.url as string,
          ...(input.headers ? { headers: input.headers as Record<string, string> } : {}),
          ...(input.body ? { body: input.body as string } : {})
        })

      case 'list_tasks':
        return client.listTasks({
          deviceId: input.deviceId as string | undefined,
          status: input.status as string | undefined,
          limit: (input.limit as number) ?? 20
        })

      case 'get_task':
        return client.getTask(input.taskId as string)

      case 'list_schedules':
        return client.listSchedules(input.deviceId as string | undefined)

      case 'create_schedule':
        return client.createSchedule({
          deviceId: input.deviceId as string,
          name: input.name as string,
          instruction: input.instruction as Record<string, unknown>,
          cronExpression: input.cronExpression as string
        })

      case 'delete_schedule':
        await client.deleteSchedule(input.scheduleId as string)
        return { success: true }

      case 'list_workflows':
        return client.listWorkflows()

      case 'create_workflow':
        return client.createWorkflow({
          name: input.name as string,
          description: input.description as string | undefined,
          steps: input.steps as Record<string, unknown>[]
        })

      case 'run_workflow':
        return client.runWorkflow(input.workflowId as string)

      case 'get_workflow_status':
        return client.getWorkflowRunDetail(input.runId as string)

      case 'list_groups':
        return client.listGroups()

      case 'create_group':
        return client.createGroup({
          name: input.name as string,
          description: input.description as string | undefined,
          tagFilter: input.tagFilter as string
        })

      case 'broadcast_command':
        return client.broadcastCommand(input.groupId as string, input.command as string)

      case 'check_minion_versions': {
        const [devices, latest] = await Promise.all([
          client.listDevices(),
          client.getMinionLatest().catch(() => null)
        ])
        const latestVersion = (latest as Record<string, unknown> | null)?.version ?? 'unknown'
        return {
          latestVersion,
          devices: devices.map((d) => ({
            id: d.id,
            name: d.name,
            status: d.status,
            version: (d as Record<string, unknown>).minionVersion ?? null,
            upToDate:
              latestVersion !== 'unknown' &&
              (d as Record<string, unknown>).minionVersion === latestVersion
          }))
        }
      }

      case 'update_minion':
        if (input.deviceId) {
          return client.updateMinion(input.deviceId as string)
        }
        return client.updateAllMinions()

      case 'get_device_metrics':
        return client.getMetrics(input.deviceId as string, (input.limit as number) ?? 20)

      case 'list_alerts':
        return client.listAlerts({
          deviceId: input.deviceId as string | undefined,
          active: (input.activeOnly as boolean | undefined) ?? false
        })

      case 'open_terminal': {
        const wsUrl = client.getTerminalWsUrl(input.deviceId as string)
        return {
          wsUrl,
          deviceId: input.deviceId,
          message: `Terminal session ready for device ${input.deviceId}. Open the Hive Terminal workspace view to connect.`
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  private async dispatchAndWait(
    device: string,
    instruction: Record<string, unknown>
  ): Promise<unknown> {
    const client = this.requireClient()
    const task = await dispatchAndPoll(client, device, instruction)

    if (task.status === 'failed' || task.status === 'timeout') {
      const err = task.results?.[0]?.error ?? `Task ${task.status}`
      throw new Error(err)
    }

    return task.results?.[0]?.result ?? { status: task.status }
  }

  private requireClient(): HiveClient {
    const client = this.getClient()
    if (!client) throw new Error('Hive not configured — set hive.url and hive.api-key in settings')
    return client
  }

  clearHistory(): void {
    this.history = []
  }
}
