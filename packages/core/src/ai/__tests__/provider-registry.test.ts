import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockProvider, createStreamingProvider, mockResponse } from './test-helpers'
import type { AIStreamChunk } from '../provider-types'

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

const { AIProviderRegistry } = await import('../provider-registry')

describe('AIProviderRegistry', () => {
  let registry: InstanceType<typeof AIProviderRegistry>

  beforeEach(() => {
    registry = new AIProviderRegistry()
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // register()
  // ---------------------------------------------------------------------------

  describe('register()', () => {
    it('registers a single provider', () => {
      const provider = createMockProvider({ id: 'claude' })
      registry.register(provider)
      expect(registry.get('claude')).toBe(provider)
    })

    it('sets first registered provider as default', () => {
      const provider = createMockProvider({ id: 'claude' })
      registry.register(provider)
      expect(registry.getDefault()).toBe(provider)
    })

    it('does NOT override default when second provider registers', () => {
      const first = createMockProvider({ id: 'claude' })
      const second = createMockProvider({ id: 'openai' })
      registry.register(first)
      registry.register(second)
      expect(registry.getDefault()).toBe(first)
    })

    it('replaces existing provider with same ID', () => {
      const original = createMockProvider({ id: 'claude', displayName: 'v1' })
      const replacement = createMockProvider({ id: 'claude', displayName: 'v2' })
      registry.register(original)
      registry.register(replacement)
      expect(registry.get('claude')!.displayName).toBe('v2')
    })
  })

  // ---------------------------------------------------------------------------
  // unregister()
  // ---------------------------------------------------------------------------

  describe('unregister()', () => {
    it('removes a provider by ID', () => {
      const provider = createMockProvider({ id: 'claude' })
      registry.register(provider)
      registry.unregister('claude')
      expect(registry.get('claude')).toBeUndefined()
    })

    it('reassigns default to next remaining provider when default is unregistered', () => {
      const claude = createMockProvider({ id: 'claude' })
      const openai = createMockProvider({ id: 'openai' })
      registry.register(claude)
      registry.register(openai)
      registry.unregister('claude')
      expect(registry.getDefault()).toBe(openai)
    })

    it('sets default to null when last provider is unregistered', () => {
      const provider = createMockProvider({ id: 'claude' })
      registry.register(provider)
      registry.unregister('claude')
      expect(registry.getDefault()).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // get() / getDefault()
  // ---------------------------------------------------------------------------

  describe('get() / getDefault()', () => {
    it('returns provider by ID', () => {
      const provider = createMockProvider({ id: 'openai' })
      registry.register(provider)
      expect(registry.get('openai')).toBe(provider)
    })

    it('returns undefined for unknown ID', () => {
      expect(registry.get('nonexistent')).toBeUndefined()
    })

    it('getDefault() returns the default provider', () => {
      const provider = createMockProvider({ id: 'claude' })
      registry.register(provider)
      expect(registry.getDefault()!.id).toBe('claude')
    })

    it('getDefault() returns undefined when no providers registered', () => {
      expect(registry.getDefault()).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // setDefault()
  // ---------------------------------------------------------------------------

  describe('setDefault()', () => {
    it('changes the default provider', () => {
      registry.register(createMockProvider({ id: 'claude' }))
      registry.register(createMockProvider({ id: 'openai' }))
      registry.setDefault('openai')
      expect(registry.getDefault()!.id).toBe('openai')
    })

    it('does nothing when ID is not registered', () => {
      registry.register(createMockProvider({ id: 'claude' }))
      registry.setDefault('nonexistent')
      expect(registry.getDefault()!.id).toBe('claude')
    })
  })

  // ---------------------------------------------------------------------------
  // list()
  // ---------------------------------------------------------------------------

  describe('list()', () => {
    it('returns all registered providers', () => {
      registry.register(createMockProvider({ id: 'claude' }))
      registry.register(createMockProvider({ id: 'openai' }))
      expect(registry.list()).toHaveLength(2)
    })

    it('returns empty array when no providers registered', () => {
      expect(registry.list()).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // toService() — facade
  // ---------------------------------------------------------------------------

  describe('toService()', () => {
    it('returns a facade with all required AIService methods', () => {
      const service = registry.toService()
      expect(service.registerProvider).toBeTypeOf('function')
      expect(service.getProvider).toBeTypeOf('function')
      expect(service.listProviders).toBeTypeOf('function')
      expect(service.setDefault).toBeTypeOf('function')
      expect(service.complete).toBeTypeOf('function')
      expect(service.chat).toBeTypeOf('function')
      expect(service.stream).toBeTypeOf('function')
    })

    it('facade.registerProvider() delegates to registry', () => {
      const service = registry.toService()
      const provider = createMockProvider({ id: 'claude' })
      service.registerProvider(provider)
      expect(registry.get('claude')).toBe(provider)
    })

    it('facade.getProvider() with no args returns default', () => {
      const provider = createMockProvider({ id: 'claude' })
      registry.register(provider)
      const service = registry.toService()
      expect(service.getProvider()).toBe(provider)
    })

    it('facade.getProvider(id) returns specific provider', () => {
      registry.register(createMockProvider({ id: 'claude' }))
      registry.register(createMockProvider({ id: 'openai' }))
      const service = registry.toService()
      expect(service.getProvider('openai')!.id).toBe('openai')
    })

    it('facade.listProviders() returns renderer-safe AIProviderInfo[]', () => {
      registry.register(
        createMockProvider({
          id: 'claude',
          displayName: 'Claude',
          capabilities: { streaming: true, toolCalling: true, vision: true, models: ['sonnet'] }
        })
      )
      const service = registry.toService()
      const info = service.listProviders()
      expect(info).toHaveLength(1)
      expect(info[0]).toEqual({
        id: 'claude',
        displayName: 'Claude',
        configured: true,
        capabilities: { streaming: true, toolCalling: true, vision: true, models: ['sonnet'] }
      })
    })
  })

  // ---------------------------------------------------------------------------
  // complete() / chat() routing
  // ---------------------------------------------------------------------------

  describe('complete() and chat() routing', () => {
    it('routes complete() to default provider', async () => {
      const provider = createMockProvider({ id: 'claude' })
      registry.register(provider)
      const service = registry.toService()
      const req = { systemPrompt: 'sys', userMessage: 'hello', tier: 'standard' as const }
      await service.complete(req)
      expect(provider.complete).toHaveBeenCalledWith(req)
    })

    it('routes complete() to specified provider by ID', async () => {
      const claude = createMockProvider({ id: 'claude' })
      const openai = createMockProvider({ id: 'openai' })
      registry.register(claude)
      registry.register(openai)
      const service = registry.toService()
      const req = { systemPrompt: 'sys', userMessage: 'hello' }
      await service.complete(req, 'openai')
      expect(openai.complete).toHaveBeenCalledWith(req)
      expect(claude.complete).not.toHaveBeenCalled()
    })

    it('routes chat() to default provider', async () => {
      const provider = createMockProvider({ id: 'claude' })
      registry.register(provider)
      const service = registry.toService()
      const req = { systemPrompt: 'sys', messages: [{ role: 'user' as const, content: 'hi' }] }
      await service.chat(req)
      expect(provider.chat).toHaveBeenCalledWith(req)
    })

    it('routes chat() to specified provider by ID', async () => {
      const claude = createMockProvider({ id: 'claude' })
      const openai = createMockProvider({ id: 'openai' })
      registry.register(claude)
      registry.register(openai)
      const service = registry.toService()
      const req = { systemPrompt: 'sys', messages: [{ role: 'user' as const, content: 'hi' }] }
      await service.chat(req, 'openai')
      expect(openai.chat).toHaveBeenCalledWith(req)
    })

    it('throws when no provider registered and complete() is called', async () => {
      const service = registry.toService()
      await expect(service.complete({ systemPrompt: 'sys', userMessage: 'hi' })).rejects.toThrow(
        'No AI provider registered'
      )
    })

    it('throws when specified provider not found', async () => {
      registry.register(createMockProvider({ id: 'claude' }))
      const service = registry.toService()
      await expect(
        service.complete({ systemPrompt: 'sys', userMessage: 'hi' }, 'nonexistent')
      ).rejects.toThrow('AI provider "nonexistent" not found')
    })
  })

  // ---------------------------------------------------------------------------
  // stream() routing
  // ---------------------------------------------------------------------------

  describe('stream() routing', () => {
    it('routes stream() to provider.stream() when provider supports streaming', async () => {
      const provider = createStreamingProvider('claude')
      registry.register(provider)
      const service = registry.toService()
      const chunks: AIStreamChunk[] = []
      await service.stream!({ systemPrompt: 'sys', userMessage: 'hello' }, (chunk) =>
        chunks.push(chunk)
      )
      expect(provider.stream).toHaveBeenCalled()
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[chunks.length - 1].done).toBe(true)
    })

    it('forwards all chunks from provider to caller', async () => {
      const provider = createStreamingProvider('claude', ['A', 'B', 'C'])
      registry.register(provider)
      const service = registry.toService()
      const chunks: AIStreamChunk[] = []
      await service.stream!({ systemPrompt: 'sys', userMessage: 'hello' }, (chunk) =>
        chunks.push(chunk)
      )
      // 3 content chunks + 1 final done chunk
      expect(chunks).toHaveLength(4)
      expect(chunks[0].delta).toBe('A')
      expect(chunks[1].delta).toBe('B')
      expect(chunks[2].delta).toBe('C')
      expect(chunks[3].done).toBe(true)
    })

    it('falls back to complete() + single chunk for non-streaming provider', async () => {
      const provider = createMockProvider({
        id: 'basic',
        capabilities: {
          streaming: false,
          toolCalling: false,
          vision: false,
          models: ['basic-model']
        },
        complete: vi.fn().mockResolvedValue(mockResponse('full response', 'basic-model'))
        // No stream method
      })
      registry.register(provider)
      const service = registry.toService()
      const chunks: AIStreamChunk[] = []
      await service.stream!({ systemPrompt: 'sys', userMessage: 'hello' }, (chunk) =>
        chunks.push(chunk)
      )
      // Falls back: one chunk with full content + done
      expect(chunks).toHaveLength(1)
      expect(chunks[0].delta).toBe('full response')
      expect(chunks[0].done).toBe(true)
      expect(chunks[0].model).toBe('basic-model')
    })

    it('routes stream() to specific provider by ID', async () => {
      const claude = createStreamingProvider('claude', ['Claude says hi'])
      const openai = createStreamingProvider('openai', ['OpenAI says hi'])
      registry.register(claude)
      registry.register(openai)
      const service = registry.toService()
      const chunks: AIStreamChunk[] = []
      await service.stream!(
        { systemPrompt: 'sys', userMessage: 'hello' },
        (chunk) => chunks.push(chunk),
        'openai'
      )
      expect(openai.stream).toHaveBeenCalled()
      expect(claude.stream).not.toHaveBeenCalled()
    })

    it('throws when no provider registered and stream() is called', async () => {
      const service = registry.toService()
      await expect(
        service.stream!({ systemPrompt: 'sys', userMessage: 'hi' }, vi.fn())
      ).rejects.toThrow('No AI provider registered')
    })
  })
})
