/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIService, AICompletionResponse } from '../../ai/provider-types'

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../config', () => ({
  getCoreConfig: () => ({ hintsDir: '/tmp/test-hints' }),
  isCoreInitialized: () => false
}))

const { SelectorHealer } = await import('../selector-healer')

const mockComplete = vi.fn<[], Promise<AICompletionResponse>>()

function createMockAIService(): AIService {
  return {
    registerProvider: vi.fn(),
    getProvider: vi.fn(),
    listProviders: () => [
      { id: 'claude', displayName: 'Claude', configured: true, capabilities: { streaming: false, toolCalling: false, vision: false, models: [] } }
    ],
    setDefault: vi.fn(),
    complete: mockComplete,
    chat: vi.fn()
  }
}

function makePage(overrides: Record<string, any> = {}): any {
  return {
    evaluate: vi.fn().mockResolvedValue('<div class="new-panel">some content here for testing</div>'),
    locator: vi.fn().mockReturnValue({
      count: vi.fn().mockResolvedValue(1),
      first: vi.fn().mockReturnValue({
        innerText: vi.fn().mockResolvedValue('text'),
        getAttribute: vi.fn().mockResolvedValue('/href')
      })
    }),
    waitForSelector: vi.fn().mockResolvedValue({}),
    ...overrides
  }
}

function mockCompleteResponse(content: string) {
  mockComplete.mockResolvedValue({
    content,
    model: 'claude-sonnet-4-5-20250929',
    usage: { inputTokens: 100, outputTokens: 50 }
  })
}

describe('SelectorHealer', () => {
  let healer: InstanceType<typeof SelectorHealer>
  let mockAI: AIService

  beforeEach(() => {
    mockAI = createMockAIService()
    healer = new SelectorHealer('linkedin', mockAI)
    healer.setAIAvailable(true)
    mockComplete.mockReset()
  })

  describe('cacheKey()', () => {
    it('produces stable keys regardless of order', () => {
      const a = SelectorHealer.cacheKey(['.foo', '.bar', '.baz'])
      const b = SelectorHealer.cacheKey(['.baz', '.foo', '.bar'])
      expect(a).toBe(b)
    })

    it('produces different keys for different selector sets', () => {
      const a = SelectorHealer.cacheKey(['.foo'])
      const b = SelectorHealer.cacheKey(['.bar'])
      expect(a).not.toBe(b)
    })
  })

  describe('getCachedRepair()', () => {
    it('returns null when no cache entry exists', () => {
      expect(healer.getCachedRepair(['.missing'])).toBeNull()
    })

    it('returns repaired selectors when cached and healthy', async () => {
      const page = makePage()
      mockCompleteResponse(
        JSON.stringify({
          selectors: ['.repaired'],
          confidence: 0.9,
          reasoning: 'found it'
        })
      )

      await healer.repair(page, ['.broken'], {})
      expect(healer.getCachedRepair(['.broken'])).toEqual(['.repaired'])
    })
  })

  describe('recordSuccess()', () => {
    it('increments successCount and boosts confidence', async () => {
      const page = makePage()
      mockCompleteResponse(
        JSON.stringify({
          selectors: ['.repaired'],
          confidence: 0.8,
          reasoning: 'found'
        })
      )

      await healer.repair(page, ['.broken'], {})
      healer.recordSuccess(['.broken'])

      expect(healer.getCachedRepair(['.broken'])).toEqual(['.repaired'])
    })
  })

  describe('recordFailure()', () => {
    it('decreases confidence below threshold', async () => {
      const page = makePage()
      mockCompleteResponse(
        JSON.stringify({
          selectors: ['.repaired'],
          confidence: 0.65,
          reasoning: 'found'
        })
      )

      await healer.repair(page, ['.broken'], {})
      healer.recordFailure(['.broken'])
      // 0.65 - 0.15 = 0.5 < 0.6 threshold
      expect(healer.getCachedRepair(['.broken'])).toBeNull()
    })
  })

  describe('repair()', () => {
    it('deduplicates: only calls AI once per selector group per session', async () => {
      const page = makePage()
      mockCompleteResponse(
        JSON.stringify({
          selectors: ['.repaired'],
          confidence: 0.9,
          reasoning: 'ok'
        })
      )

      await healer.repair(page, ['.broken'], {})
      const second = await healer.repair(page, ['.broken'], {})

      expect(mockComplete).toHaveBeenCalledTimes(1)
      expect(second).toBeNull()
    })

    it('calls AI with repair_hint task', async () => {
      const page = makePage()
      mockCompleteResponse(
        JSON.stringify({
          selectors: ['.new-sel'],
          confidence: 0.85,
          reasoning: 'matched'
        })
      )

      const result = await healer.repair(page, ['.old-sel'], { fieldName: 'description' })

      expect(mockComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.stringContaining('CSS selector repair specialist'),
          userMessage: expect.stringContaining('.old-sel'),
          tier: 'standard',
          maxTokens: 512,
          task: 'repair_hint'
        })
      )
      expect(result).toEqual(['.new-sel'])
    })

    it('returns null when AI returns empty selectors', async () => {
      const page = makePage()
      mockCompleteResponse(
        JSON.stringify({
          selectors: [],
          confidence: 0.1,
          reasoning: 'could not determine'
        })
      )

      const result = await healer.repair(page, ['.broken'], {})
      expect(result).toBeNull()
    })

    it('returns null when suggested selectors do not match page', async () => {
      const page = makePage({
        locator: vi.fn().mockReturnValue({
          count: vi.fn().mockResolvedValue(0)
        })
      })
      mockCompleteResponse(
        JSON.stringify({
          selectors: ['.wrong'],
          confidence: 0.9,
          reasoning: 'guessed'
        })
      )

      const result = await healer.repair(page, ['.broken'], {})
      expect(result).toBeNull()
    })

    it('handles AI errors gracefully', async () => {
      const page = makePage()
      mockComplete.mockRejectedValue(new Error('API down'))

      const result = await healer.repair(page, ['.broken'], {})
      expect(result).toBeNull()
    })

    it('handles invalid JSON from AI', async () => {
      const page = makePage()
      mockCompleteResponse('This is not JSON at all')

      const result = await healer.repair(page, ['.broken'], {})
      expect(result).toBeNull()
    })

    it('skips repair when DOM snapshot is too small', async () => {
      const page = makePage({ evaluate: vi.fn().mockResolvedValue('') })

      const result = await healer.repair(page, ['.broken'], {})
      expect(result).toBeNull()
      expect(mockComplete).not.toHaveBeenCalled()
    })

    it('skips repair when AI is not available', async () => {
      healer.setAIAvailable(false)
      const page = makePage()

      const result = await healer.repair(page, ['.broken'], {})
      expect(result).toBeNull()
      expect(mockComplete).not.toHaveBeenCalled()
    })
  })

  describe('resetSession()', () => {
    it('clears dedup set allowing re-attempts', async () => {
      const page = makePage()
      mockCompleteResponse(
        JSON.stringify({
          selectors: ['.repaired'],
          confidence: 0.9,
          reasoning: 'ok'
        })
      )

      await healer.repair(page, ['.broken'], {})
      expect(mockComplete).toHaveBeenCalledTimes(1)

      // Second attempt deduped
      await healer.repair(page, ['.broken'], {})
      expect(mockComplete).toHaveBeenCalledTimes(1)

      // After reset, AI is called again
      healer.resetSession()
      await healer.repair(page, ['.broken'], {})
      expect(mockComplete).toHaveBeenCalledTimes(2)
    })
  })
})
