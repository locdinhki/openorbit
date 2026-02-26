// ============================================================================
// ext-ghl — AI Chat Handler (agentic tool-calling loop)
// ============================================================================

import type {
  AIService,
  AIToolCall,
  AIToolResult,
  AIMessage
} from '@openorbit/core/ai/provider-types'
import { GHL_TOOLS, GHL_SYSTEM_PROMPT } from './ghl-tools'
import type { GhlContactsRepo } from '../db/contacts-repo'
import type { GhlOpportunitiesRepo } from '../db/opportunities-repo'
import type { GhlPipelinesRepo } from '../db/pipelines-repo'
import type { GoHighLevel } from '../sdk/index'

const MAX_HISTORY = 20
const MAX_TOOL_ROUNDS = 5

export class GhlChatHandler {
  private history: AIMessage[] = []

  constructor(
    private ai: AIService,
    private contactsRepo: GhlContactsRepo,
    private oppsRepo: GhlOpportunitiesRepo,
    private pipelinesRepo: GhlPipelinesRepo,
    private ghl: () => GoHighLevel,
    private locationId: () => string
  ) {}

  async sendMessage(message: string): Promise<string> {
    this.history.push({ role: 'user', content: message })
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY)
    }

    // Try tool-calling provider
    const provider = this.ai.getProvider()
    if (provider?.capabilities.toolCalling && provider.completeWithTools) {
      return this.agenticLoop(message, { completeWithTools: provider.completeWithTools })
    }

    // Fallback: simple chat with data snapshot
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

      // Build the user message with any tool results appended
      const userMsg =
        toolResults.length > 0
          ? `${message}\n\n[Tool Results]\n${toolResults.map((r) => `${r.toolCallId}: ${r.content}`).join('\n')}`
          : message

      const response = await provider.completeWithTools({
        systemPrompt: GHL_SYSTEM_PROMPT,
        userMessage: userMsg,
        tools: GHL_TOOLS,
        tier: 'standard',
        task: 'ghl-chat'
      })

      if (response.stopReason === 'end_turn' || response.toolCalls.length === 0) {
        this.history.push({ role: 'assistant', content: response.content })
        return response.content
      }

      // Execute tool calls
      toolResults = []
      for (const call of response.toolCalls) {
        const result = await this.executeTool(call)
        toolResults.push(result)
      }
    }

    const fallback = 'I ran into a limit processing your request. Here is what I found so far.'
    this.history.push({ role: 'assistant', content: fallback })
    return fallback
  }

  private async simpleFallback(_message: string): Promise<string> {
    // Gather a data snapshot for context
    const contacts = this.contactsRepo.list({ limit: 20 })
    const opps = this.oppsRepo.list()
    const pipelines = this.pipelinesRepo.list()

    const snapshot = [
      `Contacts (${contacts.length}): ${contacts.map((c) => c.name || c.email || c.id).join(', ')}`,
      `Opportunities (${opps.length}): ${opps.map((o) => `${o.name} ($${o.monetary_value ?? 0}) [${o.status}]`).join(', ')}`,
      `Pipelines (${pipelines.length}): ${pipelines.map((p) => p.name).join(', ')}`
    ].join('\n')

    const response = await this.ai.chat({
      systemPrompt: `${GHL_SYSTEM_PROMPT}\n\nCurrent CRM data:\n${snapshot}`,
      messages: this.history,
      tier: 'standard',
      task: 'ghl-chat'
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
    switch (name) {
      case 'list_contacts': {
        const limit = (input.limit as number) ?? 10
        return this.contactsRepo.list({ query: input.query as string, limit })
      }
      case 'get_contact': {
        return this.contactsRepo.getById(input.contactId as string)
      }
      case 'list_opportunities': {
        return this.oppsRepo.list({
          pipelineId: input.pipelineId as string,
          status: input.status as string
        })
      }
      case 'list_calendar_events': {
        const ghl = this.ghl()
        const locId = this.locationId()
        const result = await ghl.calendars.getEvents(locId, {
          calendarId: input.calendarId as string,
          startTime: input.startTime as string,
          endTime: input.endTime as string
        })
        return result.events
      }
      case 'list_conversations': {
        const ghl = this.ghl()
        const locId = this.locationId()
        const result = await ghl.conversations.list(locId, {
          contactId: input.contactId as string,
          limit: input.limit as number
        })
        return result.conversations
      }
      case 'list_pipelines': {
        return this.pipelinesRepo.list()
      }
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  clearHistory(): void {
    this.history = []
  }
}
