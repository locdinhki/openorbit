import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIService, AICompletionResponse } from '../provider-types'
import type { MemoryRepo } from '../../db/memory-repo'

const mockChat = vi.fn()

vi.mock('../claude-service', () => ({
  buildJobContext: vi.fn().mockReturnValue('## Job context')
}))

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../db/user-profile-repo', () => ({
  UserProfileRepo: class {
    get = vi.fn().mockReturnValue(null)
  }
}))

vi.mock('../../db/memory-repo', () => ({
  MemoryRepo: class {}
}))

const { ChatHandler } = await import('../chat-handler')

function mockResponse(content: string): AICompletionResponse {
  return { content, model: 'test', usage: { inputTokens: 0, outputTokens: 0 } }
}

function createMockAI(): AIService {
  return {
    registerProvider: vi.fn(),
    getProvider: vi.fn(),
    listProviders: vi.fn().mockReturnValue([]),
    setDefault: vi.fn(),
    complete: vi.fn(),
    chat: mockChat
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createMockMemoryRepo() {
  return {
    addFact: vi.fn((category: string, content: string, source: string, confidence: number) => ({
      id: `fact-${Date.now()}`,
      category,
      content,
      source,
      confidence,
      metadata: {},
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      accessedAt: '2025-01-01',
      accessCount: 0
    })),
    getByCategory: vi.fn().mockReturnValue([]),
    search: vi.fn().mockReturnValue([]),
    listAll: vi.fn().mockReturnValue([]),
    getById: vi.fn(),
    updateFact: vi.fn(),
    deleteFact: vi.fn(),
    getRecentFacts: vi.fn().mockReturnValue([])
  }
}

describe('ChatHandler', () => {
  let handler: InstanceType<typeof ChatHandler>

  beforeEach(() => {
    handler = new ChatHandler(createMockAI())
    vi.clearAllMocks()
  })

  describe('sendMessage()', () => {
    it('sends message and returns response', async () => {
      mockChat.mockResolvedValue(mockResponse('Hello! How can I help?'))

      const response = await handler.sendMessage('Hi')
      expect(response).toBe('Hello! How can I help?')
    })

    it('adds messages to history', async () => {
      mockChat.mockResolvedValue(mockResponse('Response 1'))
      await handler.sendMessage('Message 1')

      const history = handler.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0]).toEqual({ role: 'user', content: 'Message 1' })
      expect(history[1]).toEqual({ role: 'assistant', content: 'Response 1' })
    })

    it('passes job context when provided', async () => {
      mockChat.mockResolvedValue(mockResponse('Analysis complete'))
      const job = {
        id: 'job-1',
        externalId: 'ext-1',
        platform: 'linkedin',
        profileId: 'p1',
        url: 'https://example.com',
        title: 'Dev',
        company: 'Co',
        location: 'Remote',
        jobType: 'full-time',
        description: 'Build',
        postedDate: '2025-01-01',
        easyApply: true,
        status: 'new' as const,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01'
      }

      await handler.sendMessage('Analyze this', job)
      expect(mockChat).toHaveBeenCalledWith(expect.objectContaining({ task: 'chat' }))
    })
  })

  describe('history management', () => {
    it('caps history to prevent unbounded growth', async () => {
      mockChat.mockResolvedValue(mockResponse('Response'))

      // Send 15 messages — the cap slices to 20 before each API call,
      // then the assistant response pushes it to 21. The key check is
      // that history doesn't grow unbounded (30 entries for 15 messages).
      for (let i = 0; i < 15; i++) {
        await handler.sendMessage(`Message ${i}`)
      }

      const history = handler.getHistory()
      // Without cap it would be 30 (15 user + 15 assistant).
      // With cap at 20 before each send + 1 assistant after = max 21.
      expect(history.length).toBeLessThanOrEqual(21)
      expect(history.length).toBeLessThan(30)
    })

    it('rolls back user message on error', async () => {
      mockChat.mockResolvedValue(mockResponse('OK'))
      await handler.sendMessage('First message')
      expect(handler.getHistory()).toHaveLength(2)

      mockChat.mockRejectedValue(new Error('API error'))
      await expect(handler.sendMessage('Second message')).rejects.toThrow('API error')

      // Only first message pair should remain
      const history = handler.getHistory()
      expect(history).toHaveLength(2)
      expect(history[0].content).toBe('First message')
    })
  })

  describe('clearHistory()', () => {
    it('empties the history', async () => {
      mockChat.mockResolvedValue(mockResponse('Response'))
      await handler.sendMessage('Hello')
      expect(handler.getHistory()).toHaveLength(2)

      handler.clearHistory()
      expect(handler.getHistory()).toHaveLength(0)
    })
  })

  describe('getHistory()', () => {
    it('returns a copy (not the internal array)', async () => {
      mockChat.mockResolvedValue(mockResponse('Response'))
      await handler.sendMessage('Hello')

      const history = handler.getHistory()
      history.push({ role: 'user', content: 'injected' })

      expect(handler.getHistory()).toHaveLength(2) // original unchanged
    })
  })

  describe('memory integration', () => {
    it('works without memory repo (backward compatible)', async () => {
      mockChat.mockResolvedValue(mockResponse('Plain response'))
      const h = new ChatHandler(createMockAI())
      const response = await h.sendMessage('Hi')
      expect(response).toBe('Plain response')
    })

    it('injects memory context into system prompt when repo is provided', async () => {
      const repo = createMockMemoryRepo()
      repo.getByCategory.mockReturnValue([
        {
          id: 'f1',
          category: 'preference',
          content: 'Only wants remote roles',
          source: 'user',
          confidence: 1.0,
          metadata: {},
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
          accessedAt: '2025-01-01',
          accessCount: 0
        }
      ])
      mockChat.mockResolvedValue(mockResponse('Noted'))

      const h = new ChatHandler(createMockAI(), repo as unknown as MemoryRepo)
      await h.sendMessage('any jobs?')

      const chatCall = mockChat.mock.calls[0][0]
      expect(chatCall.systemPrompt).toContain('## Memory Context')
      expect(chatCall.systemPrompt).toContain('Only wants remote roles')
      expect(chatCall.systemPrompt).toContain('## Memory')
    })

    it('strips memory tags from response', async () => {
      const repo = createMockMemoryRepo()
      mockChat.mockResolvedValue(
        mockResponse(
          'Got it! <memory category="preference">Only interested in remote roles</memory>'
        )
      )

      const h = new ChatHandler(createMockAI(), repo as unknown as MemoryRepo)
      const response = await h.sendMessage('I only want remote roles')

      expect(response).not.toContain('<memory')
      expect(response).toBe('Got it!')
    })

    it('saves extracted facts via memoryRepo', async () => {
      const repo = createMockMemoryRepo()
      mockChat.mockResolvedValue(
        mockResponse('Noted. <memory category="preference">Minimum salary $150k</memory>')
      )

      const h = new ChatHandler(createMockAI(), repo as unknown as MemoryRepo)
      await h.sendMessage('I need at least $150k')

      expect(repo.addFact).toHaveBeenCalledWith('preference', 'Minimum salary $150k', 'chat', 0.8)
    })

    it('stores cleaned response in history (no tags)', async () => {
      const repo = createMockMemoryRepo()
      mockChat.mockResolvedValue(
        mockResponse('Sure! <memory category="company">Stripe uses React</memory>')
      )

      const h = new ChatHandler(createMockAI(), repo as unknown as MemoryRepo)
      await h.sendMessage('Tell me about Stripe')

      const history = h.getHistory()
      expect(history[1].content).toBe('Sure!')
      expect(history[1].content).not.toContain('<memory')
    })

    it('appends memory instruction to system prompt', async () => {
      const repo = createMockMemoryRepo()
      mockChat.mockResolvedValue(mockResponse('Hi'))

      const h = new ChatHandler(createMockAI(), repo as unknown as MemoryRepo)
      await h.sendMessage('Hi')

      const chatCall = mockChat.mock.calls[0][0]
      expect(chatCall.systemPrompt).toContain('<memory category="preference">the fact</memory>')
    })
  })
})
