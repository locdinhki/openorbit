// ============================================================================
// OpenOrbit — Claude Agent SDK AI Provider
//
// Implements AIProvider using the Claude Agent SDK, routing all AI processing
// through the user's Max plan subscription at zero additional API cost.
// ============================================================================

import { query } from '@anthropic-ai/claude-agent-sdk'
import type {
  SDKMessage,
  SDKResultSuccess,
  SDKResultError,
  SDKPartialAssistantMessage,
  SDKAssistantMessage,
  Options
} from '@anthropic-ai/claude-agent-sdk'
import type {
  AIProvider,
  AIProviderCapabilities,
  AICompletionRequest,
  AICompletionResponse,
  AIChatRequest,
  AIStreamChunk,
  AIToolRequest,
  AIToolResponse,
  AIToolCall,
  AIMessage,
  ModelTier
} from '@openorbit/core/ai/provider-types'
import { AIServiceError } from '@openorbit/core/errors'
import type { Logger } from '@openorbit/core/extensions/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map ModelTier to Agent SDK model names */
const TIER_TO_MODEL: Record<ModelTier, string> = {
  fast: 'haiku',
  standard: 'sonnet',
  premium: 'opus'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format multi-turn chat messages into a single prompt for the Agent SDK. */
function formatChatAsPrompt(messages: AIMessage[]): string {
  return messages
    .map((m) => `[${m.role === 'user' ? 'User' : 'Assistant'}]\n${m.content}`)
    .join('\n\n')
}

/** Build env that strips CLAUDECODE to avoid nested session conflicts. */
function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, val] of Object.entries(process.env)) {
    if (key === 'CLAUDECODE' || key === 'CLAUDE_CODE') continue
    if (val !== undefined) env[key] = val
  }
  return env
}

/** Extract text content from an SDKAssistantMessage's BetaMessage. */
function extractAssistantText(msg: SDKAssistantMessage): string {
  const blocks = msg.message?.content ?? []
  return blocks
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

/** Extract tool_use blocks from an SDKAssistantMessage. */
function extractToolCalls(msg: SDKAssistantMessage): AIToolCall[] {
  const blocks = msg.message?.content ?? []
  return blocks
    .filter((b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
      b.type === 'tool_use'
    )
    .map((b) => ({ id: b.id, name: b.name, input: b.input }))
}

// ---------------------------------------------------------------------------
// ClaudeSdkProvider
// ---------------------------------------------------------------------------

export class ClaudeSdkProvider implements AIProvider {
  readonly id = 'claude-sdk'
  readonly displayName = 'Claude (Max Plan)'
  readonly capabilities: AIProviderCapabilities = {
    streaming: true,
    toolCalling: true,
    vision: false,  // Agent SDK doesn't expose vision via query()
    models: ['haiku', 'sonnet', 'opus']
  }

  private log: Logger
  private configuredCache: boolean | null = null

  constructor(log: Logger) {
    this.log = log
  }

  isConfigured(): boolean {
    if (this.configuredCache !== null) return this.configuredCache

    try {
      // Check if the claude CLI exists by looking for the executable
      const { execSync } = require('child_process')
      execSync('claude --version', { stdio: 'ignore', timeout: 5000 })
      this.configuredCache = true
      return true
    } catch {
      this.configuredCache = false
      return false
    }
  }

  resetClient(): void {
    this.configuredCache = null
  }

  // -------------------------------------------------------------------------
  // complete — single-turn completion
  // -------------------------------------------------------------------------

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const model = TIER_TO_MODEL[request.tier ?? 'standard']
    const task = request.task ?? 'complete'

    this.log.info(`Claude SDK complete: task=${task}, model=${model}`)

    const options: Options = {
      systemPrompt: request.systemPrompt,
      model,
      maxTurns: 1,
      permissionMode: 'plan' as const,
      env: cleanEnv()
    }

    return this.runQuery(request.userMessage, options, task, model)
  }

  // -------------------------------------------------------------------------
  // chat — multi-turn conversation
  // -------------------------------------------------------------------------

  async chat(request: AIChatRequest): Promise<AICompletionResponse> {
    const model = TIER_TO_MODEL[request.tier ?? 'standard']
    const task = request.task ?? 'chat'

    this.log.info(`Claude SDK chat: task=${task}, model=${model}, messages=${request.messages.length}`)

    // Agent SDK takes a single prompt string, so format the conversation
    const prompt = formatChatAsPrompt(request.messages)

    const options: Options = {
      systemPrompt: request.systemPrompt,
      model,
      maxTurns: 1,
      permissionMode: 'plan' as const,
      env: cleanEnv()
    }

    return this.runQuery(prompt, options, task, model)
  }

  // -------------------------------------------------------------------------
  // stream — streaming completion
  // -------------------------------------------------------------------------

  async stream(
    request: AICompletionRequest,
    onChunk: (chunk: AIStreamChunk) => void
  ): Promise<AICompletionResponse> {
    const model = TIER_TO_MODEL[request.tier ?? 'standard']
    const task = request.task ?? 'stream'

    this.log.info(`Claude SDK stream: task=${task}, model=${model}`)

    const q = query({
      prompt: request.userMessage,
      options: {
        systemPrompt: request.systemPrompt,
        model,
        maxTurns: 1,
        permissionMode: 'plan' as const,
        includePartialMessages: true,
        env: cleanEnv()
      }
    })

    let fullContent = ''
    let resultModel = model
    let usage = { inputTokens: 0, outputTokens: 0 }

    try {
      for await (const msg of q) {
        if (msg.type === 'stream_event') {
          const partial = msg as SDKPartialAssistantMessage
          const event = partial.event as Record<string, unknown>

          // Extract text delta from the stream event
          if (event.type === 'content_block_delta') {
            const delta = event.delta as Record<string, unknown> | undefined
            if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
              fullContent += delta.text
              onChunk({ delta: delta.text, done: false })
            }
          }
        } else if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            const success = msg as SDKResultSuccess
            fullContent = success.result || fullContent
            usage = this.extractUsage(success)
            resultModel = this.extractModel(success) || model
          } else {
            const error = msg as SDKResultError
            throw new AIServiceError(
              error.errors?.join('; ') || 'Agent SDK query failed',
              'AI_REQUEST_ERROR',
              { task, model }
            )
          }
        }
      }
    } catch (err) {
      if (err instanceof AIServiceError) throw err
      throw this.wrapError(err, task, model)
    }

    const result: AICompletionResponse = { content: fullContent, model: resultModel, usage }
    onChunk({ delta: '', done: true, model: resultModel, usage })
    return result
  }

  // -------------------------------------------------------------------------
  // completeWithTools — tool/function calling
  // -------------------------------------------------------------------------

  async completeWithTools(request: AIToolRequest): Promise<AIToolResponse> {
    const model = TIER_TO_MODEL[request.tier ?? 'standard']
    const task = request.task ?? 'tool_use'

    this.log.info(`Claude SDK completeWithTools: task=${task}, model=${model}, tools=${request.tools.length}`)

    // Build Anthropic-format tool definitions for the system prompt
    const toolDescriptions = request.tools.map((t) =>
      `Tool: ${t.name}\nDescription: ${t.description}\nInput schema: ${JSON.stringify(t.inputSchema)}`
    ).join('\n\n')

    const systemPrompt = [
      request.systemPrompt,
      '\n\nYou have access to the following tools. When you want to call a tool, respond with a JSON object in the format: {"tool": "<name>", "input": {<args>}}',
      '\n\n' + toolDescriptions
    ].join('')

    const q = query({
      prompt: request.userMessage,
      options: {
        systemPrompt,
        model,
        maxTurns: 1,
        permissionMode: 'plan' as const,
        env: cleanEnv()
      }
    })

    let content = ''
    let toolCalls: AIToolCall[] = []
    let stopReason: 'end_turn' | 'tool_use' = 'end_turn'
    let resultModel = model
    let usage = { inputTokens: 0, outputTokens: 0 }

    try {
      for await (const msg of q) {
        if (msg.type === 'assistant') {
          const assistant = msg as SDKAssistantMessage
          content = extractAssistantText(assistant)
          const extracted = extractToolCalls(assistant)
          if (extracted.length > 0) {
            toolCalls = extracted
            stopReason = 'tool_use'
          }

          // Check stop_reason from the raw message
          const rawStopReason = (assistant.message as Record<string, unknown>)?.stop_reason
          if (rawStopReason === 'tool_use') {
            stopReason = 'tool_use'
          }
        } else if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            const success = msg as SDKResultSuccess
            if (!content) content = success.result || ''
            usage = this.extractUsage(success)
            resultModel = this.extractModel(success) || model
          } else {
            const error = msg as SDKResultError
            throw new AIServiceError(
              error.errors?.join('; ') || 'Agent SDK tool query failed',
              'AI_REQUEST_ERROR',
              { task, model }
            )
          }
        }
      }
    } catch (err) {
      if (err instanceof AIServiceError) throw err
      throw this.wrapError(err, task, model)
    }

    return {
      content,
      model: resultModel,
      usage,
      toolCalls,
      stopReason
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async runQuery(
    prompt: string,
    options: Options,
    task: string,
    model: string
  ): Promise<AICompletionResponse> {
    const q = query({ prompt, options })

    try {
      for await (const msg of q) {
        if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            const success = msg as SDKResultSuccess
            return {
              content: success.result,
              model: this.extractModel(success) || model,
              usage: this.extractUsage(success)
            }
          } else {
            const error = msg as SDKResultError
            throw new AIServiceError(
              error.errors?.join('; ') || 'Agent SDK query failed',
              'AI_REQUEST_ERROR',
              { task, model }
            )
          }
        }
      }
    } catch (err) {
      if (err instanceof AIServiceError) throw err
      throw this.wrapError(err, task, model)
    }

    throw new AIServiceError('No result received from Agent SDK', 'AI_REQUEST_ERROR', { task, model })
  }

  private extractUsage(result: SDKResultSuccess): { inputTokens: number; outputTokens: number } {
    const u = result.usage
    return {
      inputTokens: u?.input_tokens ?? 0,
      outputTokens: u?.output_tokens ?? 0
    }
  }

  private extractModel(result: SDKResultSuccess): string | undefined {
    // modelUsage keys are the actual model IDs used
    const models = Object.keys(result.modelUsage ?? {})
    return models[0]
  }

  private wrapError(err: unknown, task: string, model: string): AIServiceError {
    const message = err instanceof Error ? err.message : String(err)
    const isAuth = message.includes('auth') || message.includes('login')
    const code = isAuth ? 'AI_AUTH_ERROR' : 'AI_REQUEST_ERROR'
    return new AIServiceError(message, code, { task, model })
  }
}
