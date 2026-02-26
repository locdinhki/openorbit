// ============================================================================
// OpenOrbit — Ollama Provider
//
// Implements the AIProvider interface for local LLMs via Ollama.
// Connects to a local Ollama server (default: http://localhost:11434).
// No API key required — just needs Ollama running locally.
// ============================================================================

import type {
  AIProvider,
  AIProviderCapabilities,
  AICompletionRequest,
  AICompletionResponse,
  AIChatRequest,
  AIStreamChunk,
  ModelTier
} from '@openorbit/core/ai/provider-types'
import { AIServiceError } from '@openorbit/core/errors'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { ApiUsageRepo } from '@openorbit/core/db/api-usage-repo'
import type { Logger } from '@openorbit/core/extensions/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = 'http://localhost:11434'

/** Default model mapping — users can override via settings. */
const DEFAULT_TIER_MODELS: Record<ModelTier, string> = {
  fast: 'llama3.2:3b',
  standard: 'llama3.1:8b',
  premium: 'llama3.1:70b'
}

// ---------------------------------------------------------------------------
// OllamaProvider
// ---------------------------------------------------------------------------

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama'
  readonly displayName = 'Ollama (Local)'
  readonly capabilities: AIProviderCapabilities = {
    streaming: true,
    toolCalling: false,
    vision: false,
    models: [] // Populated dynamically from Ollama API
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
    // Ollama is "configured" if the server is reachable — we test lazily
    // For quick check, see if we've ever successfully fetched models
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
      this.log.info(`Ollama request: task=${task}, model=${model}`)

      const data = await this.callAPI('/api/chat', {
        model,
        stream: false,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userMessage }
        ]
      })

      const result: AICompletionResponse = {
        content: data.message?.content ?? '',
        model: data.model ?? model,
        usage: {
          inputTokens: data.prompt_eval_count ?? 0,
          outputTokens: data.eval_count ?? 0
        }
      }

      this.usageRepo.record({
        apiKeyHash: 'ollama-local',
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
        apiKeyHash: 'ollama-local',
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
      this.log.info(`Ollama chat: task=${task}, model=${model}`)

      const messages = [
        { role: 'system', content: request.systemPrompt },
        ...request.messages.map((m) => ({ role: m.role, content: m.content }))
      ]

      const data = await this.callAPI('/api/chat', {
        model,
        stream: false,
        messages
      })

      const result: AICompletionResponse = {
        content: data.message?.content ?? '',
        model: data.model ?? model,
        usage: {
          inputTokens: data.prompt_eval_count ?? 0,
          outputTokens: data.eval_count ?? 0
        }
      }

      this.usageRepo.record({
        apiKeyHash: 'ollama-local',
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
        apiKeyHash: 'ollama-local',
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
      this.log.info(`Ollama stream: task=${task}, model=${model}`)

      const baseUrl = this.getBaseUrl()
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userMessage }
          ]
        })
      })

      if (!response.ok) {
        throw new Error(`Ollama API error ${response.status}`)
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
            if (!line.trim()) continue
            try {
              const parsed = JSON.parse(line)
              if (parsed.message?.content) {
                fullContent += parsed.message.content
                onChunk({ delta: parsed.message.content, done: false })
              }
              if (parsed.done) {
                inputTokens = parsed.prompt_eval_count ?? 0
                outputTokens = parsed.eval_count ?? 0
              }
            } catch {
              // Skip malformed lines
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
        apiKeyHash: 'ollama-local',
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
        apiKeyHash: 'ollama-local',
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

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private getBaseUrl(): string {
    const url = this.settingsRepo.get('ollama_base_url')
    return (typeof url === 'string' && url.length > 0) ? url : DEFAULT_BASE_URL
  }

  private resolveModel(tier: ModelTier): string {
    // Check for user-configured model override
    const settingKey = `ollama_model_${tier}`
    const override = this.settingsRepo.get(settingKey)
    if (typeof override === 'string' && override.length > 0) return override

    return DEFAULT_TIER_MODELS[tier]
  }

  private async refreshModels(): Promise<void> {
    try {
      const baseUrl = this.getBaseUrl()
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      if (!response.ok) return

      const data = (await response.json()) as { models?: { name: string }[] }
      if (data.models) {
        this.cachedModels = data.models.map((m) => m.name)
        // Update capabilities with real model list
        ;(this.capabilities as { models: string[] }).models = this.cachedModels
        this.log.info(`Ollama: discovered ${this.cachedModels.length} models`)
      }
    } catch {
      this.log.debug('Ollama server not reachable — will retry on next request')
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
      throw new Error(`Ollama error ${response.status}: ${errText}`)
    }

    return response.json() as Promise<Record<string, unknown>>
  }

  private wrapError(err: unknown, task: string, model: string): AIServiceError {
    const message = err instanceof Error ? err.message : String(err)
    const isConnection = message.includes('ECONNREFUSED') || message.includes('fetch failed')
    const code = isConnection ? 'AI_CONNECTION_ERROR' : 'AI_REQUEST_ERROR'
    return new AIServiceError(
      isConnection ? 'Ollama server not running. Start it with: ollama serve' : message,
      code,
      { task, model, provider: 'ollama' }
    )
  }
}
