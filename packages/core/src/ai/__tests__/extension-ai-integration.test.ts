// ============================================================================
// Cross-extension AI integration tests
//
// Simulates the real extension lifecycle:
//   1. Shell creates AIProviderRegistry + facade
//   2. Provider extension activates → registers provider via facade
//   3. Consumer extension activates → constructs domain classes with facade
//   4. Consumer calls domain class method → routed through registry to provider
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIService, AIStreamChunk } from '../provider-types'
import { createMockProvider, createStreamingProvider, mockResponse } from './test-helpers'

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../claude-service', () => ({
  buildJobContext: vi.fn().mockReturnValue('## Job Context\nTitle: React Dev\nCompany: Acme')
}))

vi.mock('../memory-context', () => ({
  MemoryContextBuilder: class {
    buildJobAnalysisContext = vi.fn().mockReturnValue('')
    buildAnswerContext = vi.fn().mockReturnValue('')
  }
}))

vi.mock('../../db/user-profile-repo', () => ({
  UserProfileRepo: class {
    get = vi.fn().mockReturnValue(null)
  }
}))

const { AIProviderRegistry } = await import('../provider-registry')
const { ChatHandler } = await import('../chat-handler')
const { JobAnalyzer } = await import('../job-analyzer')

const sampleJob = {
  id: 'job-1',
  externalId: 'ext-1',
  platform: 'linkedin',
  profileId: 'profile-1',
  url: 'https://linkedin.com/jobs/1',
  title: 'React Developer',
  company: 'Acme',
  location: 'Remote',
  jobType: 'full-time',
  description: 'Build React apps',
  postedDate: '2025-01-15',
  easyApply: true,
  status: 'new' as const,
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z'
}

describe('Cross-extension AI integration', () => {
  let registry: InstanceType<typeof AIProviderRegistry>
  let service: AIService

  beforeEach(() => {
    registry = new AIProviderRegistry()
    service = registry.toService()
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Full activation flow
  // ---------------------------------------------------------------------------

  describe('full activation flow', () => {
    it('provider registration through service facade reaches registry', () => {
      const provider = createMockProvider({ id: 'claude', displayName: 'Claude (Anthropic)' })

      // Simulate ext-ai-claude activation: ctx.services.ai.registerProvider(provider)
      service.registerProvider(provider)

      expect(registry.get('claude')).toBe(provider)
      expect(registry.getDefault()!.id).toBe('claude')
    })

    it('consumer receives working AIService that routes to registered provider', async () => {
      const provider = createMockProvider({
        id: 'claude',
        complete: vi.fn().mockResolvedValue(mockResponse('Provider response'))
      })

      // Phase 1: Provider extension activates
      service.registerProvider(provider)

      // Phase 2: Consumer extension uses service.complete()
      const result = await service.complete({
        systemPrompt: 'You are helpful.',
        userMessage: 'Hello',
        tier: 'standard',
        task: 'test'
      })

      expect(result.content).toBe('Provider response')
      expect(provider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ userMessage: 'Hello', task: 'test' })
      )
    })

    it('ChatHandler constructed with facade calls through to mock provider', async () => {
      const provider = createMockProvider({
        id: 'claude',
        chat: vi.fn().mockResolvedValue(mockResponse('Claude says hello'))
      })
      service.registerProvider(provider)

      // Simulate ext-jobs: new ChatHandler(ctx.services.ai)
      const chatHandler = new ChatHandler(service)
      const response = await chatHandler.sendMessage('Hi there')

      expect(response).toBe('Claude says hello')
      expect(provider.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user', content: 'Hi there' })
          ])
        })
      )
    })

    it('JobAnalyzer constructed with facade calls through to mock provider', async () => {
      const analysisJson = JSON.stringify({
        matchScore: 85,
        reasoning: 'Great React match',
        summary: 'Senior React role',
        redFlags: [],
        highlights: ['Remote'],
        recommendedResume: 'default'
      })
      const provider = createMockProvider({
        id: 'claude',
        complete: vi.fn().mockResolvedValue(mockResponse(analysisJson))
      })
      service.registerProvider(provider)

      // Simulate ext-jobs: new JobAnalyzer(ctx.services.ai)
      const analyzer = new JobAnalyzer(service)
      const result = await analyzer.analyze(sampleJob)

      expect(result.matchScore).toBe(85)
      expect(result.reasoning).toBe('Great React match')
      expect(provider.complete).toHaveBeenCalledWith(
        expect.objectContaining({ task: 'score_job', tier: 'standard' })
      )
    })
  })

  // ---------------------------------------------------------------------------
  // Multiple providers
  // ---------------------------------------------------------------------------

  describe('multiple providers', () => {
    it('second provider registration does not disrupt existing consumer', async () => {
      const claude = createMockProvider({
        id: 'claude',
        complete: vi.fn().mockResolvedValue(mockResponse('claude response'))
      })
      service.registerProvider(claude)

      // Consumer starts using the service
      const result1 = await service.complete({ systemPrompt: 'sys', userMessage: 'test' })
      expect(result1.content).toBe('claude response')

      // Second provider registers later
      const openai = createMockProvider({ id: 'openai' })
      service.registerProvider(openai)

      // Consumer still goes to default (claude)
      const result2 = await service.complete({ systemPrompt: 'sys', userMessage: 'test2' })
      expect(result2.content).toBe('claude response')
      expect(openai.complete).not.toHaveBeenCalled()
    })

    it('consumer can select specific provider by ID', async () => {
      const claude = createMockProvider({
        id: 'claude',
        complete: vi.fn().mockResolvedValue(mockResponse('from claude'))
      })
      const openai = createMockProvider({
        id: 'openai',
        complete: vi.fn().mockResolvedValue(mockResponse('from openai'))
      })
      service.registerProvider(claude)
      service.registerProvider(openai)

      const result = await service.complete(
        { systemPrompt: 'sys', userMessage: 'test' },
        'openai'
      )
      expect(result.content).toBe('from openai')
      expect(claude.complete).not.toHaveBeenCalled()
    })

    it('switching default changes routing for all consumers', async () => {
      const claude = createMockProvider({
        id: 'claude',
        complete: vi.fn().mockResolvedValue(mockResponse('claude'))
      })
      const openai = createMockProvider({
        id: 'openai',
        complete: vi.fn().mockResolvedValue(mockResponse('openai'))
      })
      service.registerProvider(claude)
      service.registerProvider(openai)

      service.setDefault('openai')

      const result = await service.complete({ systemPrompt: 'sys', userMessage: 'test' })
      expect(result.content).toBe('openai')
    })

    it('listProviders() shows both providers with correct status', () => {
      service.registerProvider(
        createMockProvider({ id: 'claude', isConfigured: vi.fn().mockReturnValue(true) })
      )
      service.registerProvider(
        createMockProvider({ id: 'openai', isConfigured: vi.fn().mockReturnValue(false) })
      )

      const providers = service.listProviders()
      expect(providers).toHaveLength(2)

      const claude = providers.find((p) => p.id === 'claude')!
      const openai = providers.find((p) => p.id === 'openai')!
      expect(claude.configured).toBe(true)
      expect(openai.configured).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Streaming through the stack
  // ---------------------------------------------------------------------------

  describe('streaming through stack', () => {
    it('consumer calls service.stream() and receives chunks from provider', async () => {
      const provider = createStreamingProvider('claude', ['Hello', ' from', ' Claude'])
      service.registerProvider(provider)

      const chunks: AIStreamChunk[] = []
      const result = await service.stream!(
        { systemPrompt: 'sys', userMessage: 'hi' },
        (chunk) => chunks.push(chunk)
      )

      // 3 content chunks + 1 final done chunk
      expect(chunks).toHaveLength(4)
      expect(chunks.map((c) => c.delta).join('')).toBe('Hello from Claude')
      expect(chunks[3].done).toBe(true)
      expect(result.content).toBe('Hello from Claude')
    })
  })

  // ---------------------------------------------------------------------------
  // Error propagation
  // ---------------------------------------------------------------------------

  describe('error propagation', () => {
    it('provider error propagates through registry to consumer domain class', async () => {
      const provider = createMockProvider({
        id: 'claude',
        chat: vi.fn().mockRejectedValue(new Error('API rate limit exceeded'))
      })
      service.registerProvider(provider)

      const chatHandler = new ChatHandler(service)
      await expect(chatHandler.sendMessage('hello')).rejects.toThrow('API rate limit exceeded')
    })

    it('calling service.complete() before any provider registers throws clear error', async () => {
      await expect(
        service.complete({ systemPrompt: 'sys', userMessage: 'hello' })
      ).rejects.toThrow('No AI provider registered')
    })
  })
})
