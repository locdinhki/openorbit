// ============================================================================
// OpenOrbit — LM Studio Provider
//
// Implements the AIProvider interface for local LLMs via LM Studio.
// Connects to a local LM Studio server (default: http://localhost:1234).
// Uses OpenAI-compatible API format (/v1/chat/completions, /v1/models).
// No API key required — just needs LM Studio running with a model loaded.
// ============================================================================

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
  ModelTier
} from '@openorbit/core/ai/provider-types'
import { AIServiceError } from '@openorbit/core/errors'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { ApiUsageRepo } from '@openorbit/core/db/api-usage-repo'
import type { Logger } from '@openorbit/core/extensions/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'http://localhost:1234'

/** Shape of the OpenAI-compatible /v1/chat/completions response. */
interface LmStudioChatResponse {
  choices: Array<{
    message?: {
      content?: string
      tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
    }
    finish_reason?: string
  }>
  model: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
}

/** Shape of the /v1/models response. */
interface LmStudioModelsResponse {
  data: Array<{ id: string }>
}

// ---------------------------------------------------------------------------
// LmStudioProvider
// ---------------------------------------------------------------------------

export class LmStudioProvider implements AIProvider {
  readonly id = 'lm-studio'
  readonly displayName = 'LM Studio (Local)'
  readonly capabilities: AIProviderCapabilities = {
    streaming: true,
    toolCalling: true,
    vision: false,
    models: [] // Populated dynamically from LM Studio API
  }

  private settingsRepo = new SettingsRepo()
  private usageRepo = new ApiUsageRepo()
  private log: Logger
  private cachedModels: string[] | null = null

  constructor(log: Logger) {
    this.log = log
    // Attempt to populate models list on construction (non-blocking)
    this.refreshModels().catch(() => {})
  }

  isConfigured(): boolean {
    return this.cachedModels !== null && this.cachedModels.length > 0
  }

  resetClient(): void {
    this.cachedModels = null
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const model = this.resolveModel(request.tier ?? 'standard')
    const task = request.task ?? 'complete'
    const start = Date.now()

    try {
      this.log.info(`LM Studio request: task=${task}, model=${model}`)

      const data = (await this.callAPI('/v1/chat/completions', {
        model,
        stream: false,
        max_tokens: request.maxTokens ?? 2048,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userMessage }
        ]
      })) as unknown as LmStudioChatResponse

      const result: AICompletionResponse = {
        content: data.choices[0]?.message?.content ?? '',
        model: data.model ?? model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0
        }
      }

      this.usageRepo.record({
        apiKeyHash: 'lmstudio-local',
        model,
        task,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs: Date.now() - start,
        success: true
      })

      return result
    } catch (err) {
      this.usageRepo.record({
        apiKeyHash: 'lmstudio-local',
        model,
        task,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        success: false,
        errorCode: 'ERROR'
      })
      throw this.wrapError(err, task, model)
    }
  }

  async chat(request: AIChatRequest): Promise<AICompletionResponse> {
    const model = this.resolveModel(request.tier ?? 'standard')
    const task = request.task ?? 'chat'
    const start = Date.now()

    try {
      this.log.info(`LM Studio chat: task=${task}, model=${model}`)

      const messages = [
        { role: 'system' as const, content: request.systemPrompt },
        ...request.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
      ]

      const data = (await this.callAPI('/v1/chat/completions', {
        model,
        stream: false,
        max_tokens: request.maxTokens ?? 2048,
        messages
      })) as unknown as LmStudioChatResponse

      const result: AICompletionResponse = {
        content: data.choices[0]?.message?.content ?? '',
        model: data.model ?? model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0
        }
      }

      this.usageRepo.record({
        apiKeyHash: 'lmstudio-local',
        model,
        task,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs: Date.now() - start,
        success: true
      })

      return result
    } catch (err) {
      this.usageRepo.record({
        apiKeyHash: 'lmstudio-local',
        model,
        task,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        success: false,
        errorCode: 'ERROR'
      })
      throw this.wrapError(err, task, model)
    }
  }

  async stream(
    request: AICompletionRequest,
    onChunk: (chunk: AIStreamChunk) => void
  ): Promise<AICompletionResponse> {
    const model = this.resolveModel(request.tier ?? 'standard')
    const task = request.task ?? 'stream'
    const start = Date.now()

    try {
      this.log.info(`LM Studio stream: task=${task}, model=${model}`)

      const baseUrl = this.getBaseUrl()
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: true,
          stream_options: { include_usage: true },
          max_tokens: request.maxTokens ?? 2048,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userMessage }
          ]
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`LM Studio API error ${response.status}: ${errText}`)
      }

      let fullContent = ''
      let inputTokens = 0
      let outputTokens = 0

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6).trim()
            if (payload === '[DONE]') continue

            try {
              const parsed = JSON.parse(payload)
              const delta = parsed.choices?.[0]?.delta?.content ?? ''
              if (delta) {
                fullContent += delta
                onChunk({ delta, done: false })
              }
              if (parsed.usage) {
                inputTokens = parsed.usage.prompt_tokens ?? 0
                outputTokens = parsed.usage.completion_tokens ?? 0
              }
            } catch {
              // Skip malformed SSE lines
            }
          }
        }
      }

      const result: AICompletionResponse = {
        content: fullContent,
        model,
        usage: { inputTokens, outputTokens }
      }

      onChunk({ delta: '', done: true, model, usage: result.usage })

      this.usageRepo.record({
        apiKeyHash: 'lmstudio-local',
        model,
        task,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - start,
        success: true
      })

      return result
    } catch (err) {
      this.usageRepo.record({
        apiKeyHash: 'lmstudio-local',
        model,
        task,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        success: false,
        errorCode: 'STREAM_ERROR'
      })
      throw this.wrapError(err, task, model)
    }
  }

  async completeWithTools(request: AIToolRequest): Promise<AIToolResponse> {
    const model = this.resolveModel(request.tier ?? 'standard')
    const task = request.task ?? 'tool_use'
    const start = Date.now()

    try {
      this.log.info(`LM Studio tool use: task=${task}, model=${model}`)

      const tools = request.tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }
      }))

      const data = (await this.callAPI('/v1/chat/completions', {
        model,
        stream: false,
        max_tokens: request.maxTokens ?? 4096,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userMessage }
        ],
        tools
      })) as unknown as LmStudioChatResponse

      const choice = data.choices[0]

      const toolCalls: AIToolCall[] = (choice?.message?.tool_calls ?? []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments)
      }))

      const result: AIToolResponse = {
        content: choice?.message?.content ?? '',
        model: data.model ?? model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0
        },
        toolCalls,
        stopReason: choice?.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn'
      }

      this.usageRepo.record({
        apiKeyHash: 'lmstudio-local',
        model,
        task,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        latencyMs: Date.now() - start,
        success: true
      })

      return result
    } catch (err) {
      this.usageRepo.record({
        apiKeyHash: 'lmstudio-local',
        model,
        task,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - start,
        success: false,
        errorCode: 'ERROR'
      })
      throw this.wrapError(err, task, model)
    }
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private getBaseUrl(): string {
    const url = this.settingsRepo.get('lmstudio_base_url')
    return typeof url === 'string' && url.length > 0 ? url : DEFAULT_BASE_URL
  }

  private resolveModel(tier: ModelTier): string {
    // Check for user-configured model override
    const settingKey = `lmstudio_model_${tier}`
    const override = this.settingsRepo.get(settingKey)
    if (typeof override === 'string' && override.length > 0) return override

    // Fall back to first discovered model
    if (this.cachedModels && this.cachedModels.length > 0) {
      return this.cachedModels[0]
    }

    return 'default'
  }

  private async refreshModels(): Promise<void> {
    try {
      const baseUrl = this.getBaseUrl()
      const response = await fetch(`${baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(3000)
      })
      if (!response.ok) return

      const data = (await response.json()) as LmStudioModelsResponse
      if (data.data) {
        this.cachedModels = data.data.map((m) => m.id)
        ;(this.capabilities as { models: string[] }).models = this.cachedModels
        this.log.info(`LM Studio: discovered ${this.cachedModels.length} models`)
      }
    } catch {
      this.log.debug('LM Studio server not reachable — will retry on next request')
    }
  }

  private async callAPI(path: string, body: unknown): Promise<Record<string, unknown>> {
    const baseUrl = this.getBaseUrl()
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`LM Studio error ${response.status}: ${errText}`)
    }

    return response.json() as Promise<Record<string, unknown>>
  }

  private wrapError(err: unknown, task: string, model: string): AIServiceError {
    const message = err instanceof Error ? err.message : String(err)
    const isConnection = message.includes('ECONNREFUSED') || message.includes('fetch failed')
    const code = isConnection ? 'AI_CONNECTION_ERROR' : 'AI_REQUEST_ERROR'
    return new AIServiceError(
      isConnection ? 'LM Studio server not running. Start it and load a model.' : message,
      code,
      { task, model, provider: 'lm-studio' }
    )
  }
}
