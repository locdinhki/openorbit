// ============================================================================
// OpenOrbit — AI Provider Registry
//
// Shell-level registry that manages AI providers contributed by extensions.
// Extensions call `ctx.services.ai.registerProvider(provider)` during
// activation. Other extensions (or the shell) use `ctx.services.ai.complete()`
// / `ctx.services.ai.chat()` which delegates to the default provider.
// ============================================================================

import type {
  AIProvider,
  AIProviderInfo,
  AICompletionRequest,
  AICompletionResponse,
  AIChatRequest,
  AIStreamChunk,
  AIService
} from './provider-types'
import { createLogger } from '../utils/logger'

const log = createLogger('AIProviderRegistry')

export class AIProviderRegistry {
  private providers = new Map<string, AIProvider>()
  private defaultProviderId: string | null = null

  /** Register a new AI provider. First registered becomes default. */
  register(provider: AIProvider): void {
    if (this.providers.has(provider.id)) {
      log.warn(`Provider "${provider.id}" already registered, replacing`)
    }

    this.providers.set(provider.id, provider)
    log.info(`Registered AI provider: ${provider.displayName} (${provider.id})`)

    // Auto-set default to first registered provider
    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.id
      log.info(`Default AI provider set to: ${provider.id}`)
    }
  }

  /** Unregister a provider by ID. */
  unregister(id: string): void {
    this.providers.delete(id)

    if (this.defaultProviderId === id) {
      // Fall back to first remaining provider, or null
      const first = this.providers.keys().next()
      this.defaultProviderId = first.done ? null : first.value
      log.info(`Default AI provider changed to: ${this.defaultProviderId ?? '(none)'}`)
    }
  }

  /** Get a provider by ID. */
  get(id: string): AIProvider | undefined {
    return this.providers.get(id)
  }

  /** Get the default provider. */
  getDefault(): AIProvider | undefined {
    if (!this.defaultProviderId) return undefined
    return this.providers.get(this.defaultProviderId)
  }

  /** Set the default provider by ID. */
  setDefault(id: string): void {
    if (!this.providers.has(id)) {
      log.error(`Cannot set default: provider "${id}" not registered`)
      return
    }
    this.defaultProviderId = id
    log.info(`Default AI provider set to: ${id}`)
  }

  /** List all registered providers (renderer-safe summary). */
  list(): AIProvider[] {
    return [...this.providers.values()]
  }

  /** Create the AIService facade for SharedServices. */
  toService(): AIService {
    return {
      registerProvider: (provider) => this.register(provider),
      getProvider: (id?) => (id ? this.get(id) : this.getDefault()),
      listProviders: () => this.listProviderInfo(),
      setDefault: (id) => this.setDefault(id),
      complete: (req, providerId?) => this.complete(req, providerId),
      chat: (req, providerId?) => this.chat(req, providerId),
      stream: (req, onChunk, providerId?) => this.stream(req, onChunk, providerId)
    }
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private listProviderInfo(): AIProviderInfo[] {
    return this.list().map((p) => ({
      id: p.id,
      displayName: p.displayName,
      configured: p.isConfigured(),
      capabilities: p.capabilities
    }))
  }

  private resolveProvider(providerId?: string): AIProvider {
    const provider = providerId ? this.get(providerId) : this.getDefault()
    if (!provider) {
      throw new Error(
        providerId
          ? `AI provider "${providerId}" not found.`
          : 'No AI provider registered. Install an AI provider extension.'
      )
    }
    return provider
  }

  private async complete(
    request: AICompletionRequest,
    providerId?: string
  ): Promise<AICompletionResponse> {
    return this.resolveProvider(providerId).complete(request)
  }

  private async chat(request: AIChatRequest, providerId?: string): Promise<AICompletionResponse> {
    return this.resolveProvider(providerId).chat(request)
  }

  private async stream(
    request: AICompletionRequest,
    onChunk: (chunk: AIStreamChunk) => void,
    providerId?: string
  ): Promise<AICompletionResponse> {
    const provider = this.resolveProvider(providerId)
    if (!provider.stream) {
      // Fallback: non-streaming completion, emit single chunk
      const result = await provider.complete(request)
      onChunk({ delta: result.content, done: true, model: result.model, usage: result.usage })
      return result
    }
    return provider.stream(request, onChunk)
  }
}
