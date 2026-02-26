// ============================================================================
// OpenOrbit — OpenAI Provider
//
// Implements the AIProvider interface using the OpenAI SDK.
// Supports GPT-4o, GPT-4o-mini, and o1 model families.
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
import { AIServiceError, AuthenticationError } from '@openorbit/core/errors'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { ApiUsageRepo } from '@openorbit/core/db/api-usage-repo'
import type { Logger } from '@openorbit/core/extensions/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENAI_MODELS = {
  GPT4O_MINI: 'gpt-4o-mini',
  GPT4O: 'gpt-4o',
  O1: 'o1'
} as const

const TIER_MODEL_CHAINS: Record<ModelTier, string[]> = {
  fast: [OPENAI_MODELS.GPT4O_MINI, OPENAI_MODELS.GPT4O],
  standard: [OPENAI_MODELS.GPT4O],
  premium: [OPENAI_MODELS.O1, OPENAI_MODELS.GPT4O]
}

const MAX_RETRY_ATTEMPTS = 3
const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

// ---------------------------------------------------------------------------
// OpenAIProvider
// ---------------------------------------------------------------------------

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai'
  readonly displayName = 'OpenAI (GPT)'
  readonly capabilities: AIProviderCapabilities = {
    streaming: true,
    toolCalling: true,
    vision: true,
    models: [OPENAI_MODELS.GPT4O_MINI, OPENAI_MODELS.GPT4O, OPENAI_MODELS.O1]
  }

  private settingsRepo = new SettingsRepo()
  private usageRepo = new ApiUsageRepo()
  private log: Logger

  constructor(log: Logger) {
    this.log = log
  }

  isConfigured(): boolean {
    try {
      const key = this.settingsRepo.get('openai_api_key')
      return typeof key === 'string' && key.length > 0
    } catch {
      return false
    }
  }

  resetClient(): void {
    // No client caching needed — we create fresh fetch requests
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const tier = request.tier ?? 'standard'
    const maxTokens = request.maxTokens ?? 2048
    const task = request.task ?? 'complete'
    const models = TIER_MODEL_CHAINS[tier]

    return this.executeWithRetry(models, task, async (model) => {
      const body = {
        model,
        max_completion_tokens: maxTokens,
        messages: [
          { role: 'system' as const, content: request.systemPrompt },
          { role: 'user' as const, content: request.userMessage }
        ]
      }

      const data = await this.callAPI('/v1/chat/completions', body)

      return {
        content: data.choices[0]?.message?.content ?? '',
        model: data.model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0
        }
      }
    })
  }

  async chat(request: AIChatRequest): Promise<AICompletionResponse> {
    const tier = request.tier ?? 'standard'
    const maxTokens = request.maxTokens ?? 2048
    const task = request.task ?? 'chat'
    const models = TIER_MODEL_CHAINS[tier]

    return this.executeWithRetry(models, task, async (model) => {
      const messages = [
        { role: 'system' as const, content: request.systemPrompt },
        ...request.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      ]

      const body = { model, max_completion_tokens: maxTokens, messages }
      const data = await this.callAPI('/v1/chat/completions', body)

      return {
        content: data.choices[0]?.message?.content ?? '',
        model: data.model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0
        }
      }
    })
  }

  async stream(
    request: AICompletionRequest,
    onChunk: (chunk: AIStreamChunk) => void
  ): Promise<AICompletionResponse> {
    const tier = request.tier ?? 'standard'
    const maxTokens = request.maxTokens ?? 2048
    const task = request.task ?? 'stream'
    const model = TIER_MODEL_CHAINS[tier][0]
    const apiKey = this.getApiKey()
    const start = Date.now()

    try {
      this.log.info(`OpenAI stream: task=${task}, model=${model}`)

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          max_completion_tokens: maxTokens,
          stream: true,
          stream_options: { include_usage: true },
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userMessage }
          ]
        })
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`OpenAI API error ${response.status}: ${errText}`)
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
        apiKeyHash: 'openai',
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
        apiKeyHash: 'openai',
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
    const tier = request.tier ?? 'standard'
    const maxTokens = request.maxTokens ?? 4096
    const task = request.task ?? 'tool_use'
    const models = TIER_MODEL_CHAINS[tier]

    return this.executeWithRetry(models, task, async (model) => {
      const tools = request.tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema
        }
      }))

      const body = {
        model,
        max_completion_tokens: maxTokens,
        messages: [
          { role: 'system' as const, content: request.systemPrompt },
          { role: 'user' as const, content: request.userMessage }
        ],
        tools
      }

      const data = await this.callAPI('/v1/chat/completions', body)
      const choice = data.choices[0]

      const toolCalls: AIToolCall[] = (choice?.message?.tool_calls ?? []).map(
        (tc: { id: string; function: { name: string; arguments: string } }) => ({
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments)
        })
      )

      return {
        content: choice?.message?.content ?? '',
        model: data.model,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0
        },
        toolCalls,
        stopReason: choice?.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn'
      } as AIToolResponse
    }) as Promise<AIToolResponse>
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private getApiKey(): string {
    const key = this.settingsRepo.get('openai_api_key')
    if (!key || typeof key !== 'string') {
      throw new AuthenticationError('OpenAI API key not configured. Go to Settings to add your key.')
    }
    return key
  }

  private async callAPI(path: string, body: unknown): Promise<Record<string, unknown>> {
    const apiKey = this.getApiKey()
    const response = await fetch(`https://api.openai.com${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errText = await response.text()
      if (response.status === 429) throw new Error(`rate limit: ${errText}`)
      if (response.status === 401) throw new AuthenticationError('Invalid OpenAI API key')
      throw new Error(`OpenAI API error ${response.status}: ${errText}`)
    }

    return response.json() as Promise<Record<string, unknown>>
  }

  private async executeWithRetry(
    models: string[],
    task: string,
    fn: (model: string) => Promise<AICompletionResponse>
  ): Promise<AICompletionResponse> {
    let lastError: Error | null = null

    for (const model of models) {
      for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        const start = Date.now()

        try {
          this.log.info(`OpenAI request: task=${task}, model=${model}, attempt=${attempt + 1}`)
          const result = await fn(model)

          this.usageRepo.record({
            apiKeyHash: 'openai',
            model,
            task,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            latencyMs: Date.now() - start,
            success: true
          })

          return result
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          const latency = Date.now() - start
          const isRateLimit = lastError.message.includes('rate') || lastError.message.includes('429')
          const isTimeout = lastError.message.includes('timeout')

          this.usageRepo.record({
            apiKeyHash: 'openai',
            model,
            task,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: latency,
            success: false,
            errorCode: isRateLimit ? 'RATE_LIMITED' : isTimeout ? 'TIMEOUT' : 'ERROR'
          })

          if (isRateLimit || isTimeout) {
            const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS)
            await new Promise((r) => setTimeout(r, delay))
            continue
          }

          throw this.wrapError(err, task, model)
        }
      }

      this.log.warn(`Exhausted retries for OpenAI model=${model}, trying fallback`)
    }

    throw this.wrapError(lastError, task, models[models.length - 1])
  }

  private wrapError(err: unknown, task: string, model: string): AIServiceError {
    const message = err instanceof Error ? err.message : String(err)
    const code = message.includes('timeout')
      ? 'AI_TIMEOUT'
      : message.includes('rate')
        ? 'RATE_LIMITED'
        : 'AI_REQUEST_ERROR'
    return new AIServiceError(message, code, { task, model, provider: 'openai' })
  }
}
