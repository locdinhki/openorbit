// ============================================================================
// OpenOrbit — Claude AI Provider
//
// Implements the AIProvider interface using the Anthropic SDK.
// Handles API key rotation, retry with exponential backoff, and model failover.
// ============================================================================

import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
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

const CLAUDE_MODELS = {
  HAIKU: 'claude-haiku-4-5-20251001',
  SONNET: 'claude-sonnet-4-5-20250929',
  OPUS: 'claude-opus-4-6'
} as const

const MAX_RETRY_ATTEMPTS = 3
const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

/** Map ModelTier to Claude model, with failover chains */
const TIER_MODEL_CHAINS: Record<ModelTier, string[]> = {
  fast: [CLAUDE_MODELS.HAIKU, CLAUDE_MODELS.SONNET],
  standard: [CLAUDE_MODELS.SONNET],
  premium: [CLAUDE_MODELS.OPUS, CLAUDE_MODELS.SONNET]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('rate') || err.message.includes('429')
  }
  return false
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('timeout') || err.message.includes('ETIMEDOUT')
  }
  return false
}

// ---------------------------------------------------------------------------
// ClaudeProvider
// ---------------------------------------------------------------------------

export class ClaudeProvider implements AIProvider {
  readonly id = 'claude'
  readonly displayName = 'Claude (Anthropic)'
  readonly capabilities: AIProviderCapabilities = {
    streaming: true,
    toolCalling: true,
    vision: true,
    models: [CLAUDE_MODELS.HAIKU, CLAUDE_MODELS.SONNET, CLAUDE_MODELS.OPUS]
  }

  private clients = new Map<string, Anthropic>()
  private keyIndex = 0
  private settingsRepo = new SettingsRepo()
  private usageRepo = new ApiUsageRepo()
  private log: Logger

  constructor(log: Logger) {
    this.log = log
  }

  isConfigured(): boolean {
    try {
      return this.getKeys().length > 0
    } catch {
      return false
    }
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const tier = request.tier ?? 'standard'
    const maxTokens = request.maxTokens ?? 2048
    const task = request.task ?? 'complete'
    const models = TIER_MODEL_CHAINS[tier]

    return this.executeWithRetry(models, task, maxTokens, async (client, model) => {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userMessage }]
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      return {
        content: textBlock?.text ?? '',
        model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        }
      }
    })
  }

  async chat(request: AIChatRequest): Promise<AICompletionResponse> {
    const tier = request.tier ?? 'standard'
    const maxTokens = request.maxTokens ?? 2048
    const task = request.task ?? 'chat'
    const models = TIER_MODEL_CHAINS[tier]

    return this.executeWithRetry(models, task, maxTokens, async (client, model) => {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: request.systemPrompt,
        messages: request.messages
      })

      const textBlock = response.content.find((b) => b.type === 'text')
      return {
        content: textBlock?.text ?? '',
        model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
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
    const models = TIER_MODEL_CHAINS[tier]

    // Streaming doesn't retry internally — use first model in chain
    const model = models[0]
    const keyInfo = this.getNextKey()
    const client = this.getClientForKey(keyInfo.key)
    const start = Date.now()

    try {
      this.log.info(`Claude stream: task=${task}, model=${model}`)

      const stream = await client.messages.stream({
        model,
        max_tokens: maxTokens,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userMessage }]
      })

      let fullContent = ''
      let inputTokens = 0
      let outputTokens = 0

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullContent += event.delta.text
          onChunk({ delta: event.delta.text, done: false })
        } else if (event.type === 'message_delta') {
          outputTokens = event.usage.output_tokens
        } else if (event.type === 'message_start') {
          inputTokens = event.message.usage.input_tokens
        }
      }

      const result: AICompletionResponse = {
        content: fullContent,
        model,
        usage: { inputTokens, outputTokens }
      }

      // Final chunk
      onChunk({ delta: '', done: true, model, usage: result.usage })

      this.usageRepo.record({
        apiKeyHash: keyInfo.hash,
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
        apiKeyHash: keyInfo.hash,
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

    return this.executeWithRetry(models, task, maxTokens, async (client, model) => {
      // Convert our tool definitions to Anthropic's format
      const tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema
      }))

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: request.systemPrompt,
        messages: [{ role: 'user' as const, content: request.userMessage }],
        tools
      })

      // Extract text content
      const textBlocks = response.content.filter((b) => b.type === 'text')
      const content = textBlocks.map((b) => (b as { text: string }).text).join('')

      // Extract tool use blocks
      const toolCalls: AIToolCall[] = response.content
        .filter((b) => b.type === 'tool_use')
        .map((b) => {
          const toolUse = b as { id: string; name: string; input: Record<string, unknown> }
          return {
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input
          }
        })

      return {
        content,
        model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        },
        toolCalls,
        stopReason: response.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn'
      } as AIToolResponse
    }) as Promise<AIToolResponse>
  }

  /** Reset all cached clients (e.g., after API key change). */
  resetClient(): void {
    this.clients.clear()
    this.keyIndex = 0
  }

  // -------------------------------------------------------------------------
  // Private: retry + failover loop
  // -------------------------------------------------------------------------

  private async executeWithRetry(
    models: string[],
    task: string,
    _maxTokens: number,
    fn: (client: Anthropic, model: string) => Promise<AICompletionResponse>
  ): Promise<AICompletionResponse> {
    let lastError: Error | null = null

    for (const model of models) {
      for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        const keyInfo = attempt === 0 ? this.getNextKey() : (this.rotateKey() ?? this.getNextKey())
        const client = this.getClientForKey(keyInfo.key)
        const start = Date.now()

        try {
          this.log.info(`Claude request: task=${task}, model=${model}, attempt=${attempt + 1}`)

          const result = await fn(client, model)

          this.usageRepo.record({
            apiKeyHash: keyInfo.hash,
            model,
            task,
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
            latencyMs: Date.now() - start,
            success: true
          })

          return result
        } catch (err) {
          const latency = Date.now() - start
          lastError = err instanceof Error ? err : new Error(String(err))

          const rateLimit = isRateLimitError(err)
          const timeout = isTimeoutError(err)
          const errorCode = rateLimit ? 'RATE_LIMITED' : timeout ? 'TIMEOUT' : 'ERROR'

          this.usageRepo.record({
            apiKeyHash: keyInfo.hash,
            model,
            task,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: latency,
            success: false,
            errorCode
          })

          if (rateLimit) {
            this.log.warn(`Rate limited on key ${keyInfo.hash.slice(0, 8)}, rotating`)
            continue
          }

          if (timeout) {
            this.log.warn(`Timeout on model=${model}, attempt=${attempt + 1}, backing off`)
            await this.backoff(attempt)
            continue
          }

          // Non-retryable error
          throw this.wrapError(err, task, model)
        }
      }

      this.log.warn(`Exhausted ${MAX_RETRY_ATTEMPTS} retries for model=${model}, trying fallback`)
    }

    throw this.wrapError(lastError, task, models[models.length - 1])
  }

  // -------------------------------------------------------------------------
  // Private: key management
  // -------------------------------------------------------------------------

  private getKeys(): string[] {
    const keys = this.settingsRepo.getApiKeys()
    if (keys.length === 0) {
      throw new AuthenticationError(
        'Anthropic API key not configured. Go to Settings to add your key.'
      )
    }
    return keys
  }

  private getNextKey(): { key: string; hash: string } {
    const keys = this.getKeys()
    const key = keys[this.keyIndex % keys.length]
    return { key, hash: hashApiKey(key) }
  }

  private rotateKey(): { key: string; hash: string } | null {
    const keys = this.getKeys()
    if (keys.length <= 1) return null
    this.keyIndex = (this.keyIndex + 1) % keys.length
    const key = keys[this.keyIndex]
    return { key, hash: hashApiKey(key) }
  }

  private getClientForKey(key: string): Anthropic {
    const hash = hashApiKey(key)
    let client = this.clients.get(hash)
    if (!client) {
      client = new Anthropic({ apiKey: key })
      this.clients.set(hash, client)
    }
    return client
  }

  // -------------------------------------------------------------------------
  // Private: backoff + error wrapping
  // -------------------------------------------------------------------------

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS)
    const jitter = delay * 0.1 * Math.random()
    await new Promise((r) => setTimeout(r, delay + jitter))
  }

  private wrapError(err: unknown, task: string, model: string): AIServiceError {
    const message = err instanceof Error ? err.message : String(err)
    const isTimeout = message.includes('timeout') || message.includes('ETIMEDOUT')
    const isRateLimit = message.includes('rate') || message.includes('429')
    const code = isTimeout ? 'AI_TIMEOUT' : isRateLimit ? 'RATE_LIMITED' : 'AI_REQUEST_ERROR'
    return new AIServiceError(message, code, { task, model })
  }
}
