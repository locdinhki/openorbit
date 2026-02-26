import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIService, AICompletionResponse } from '../provider-types'

const mockComplete = vi.fn()

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

const { AnswerGenerator } = await import('../answer-generator')

function mockResponse(content: string): AICompletionResponse {
  return { content, model: 'test', usage: { inputTokens: 0, outputTokens: 0 } }
}

function createMockAI(): AIService {
  return {
    registerProvider: vi.fn(),
    getProvider: vi.fn(),
    listProviders: vi.fn().mockReturnValue([]),
    setDefault: vi.fn(),
    complete: mockComplete,
    chat: vi.fn()
  }
}

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
  description: 'Build things',
  postedDate: '2025-01-15',
  easyApply: true,
  status: 'new' as const,
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z'
}

describe('AnswerGenerator', () => {
  let generator: InstanceType<typeof AnswerGenerator>

  beforeEach(() => {
    generator = new AnswerGenerator(createMockAI())
    vi.clearAllMocks()
  })

  describe('generateAnswer()', () => {
    it('parses valid JSON response', async () => {
      mockComplete.mockResolvedValue(
        mockResponse(
          JSON.stringify({
            answer: '10 years of React experience',
            confidence: 0.9,
            needsReview: false
          })
        )
      )

      const result = await generator.generateAnswer('Years of experience?', sampleJob)
      expect(result.answer).toBe('10 years of React experience')
      expect(result.confidence).toBe(0.9)
      expect(result.needsReview).toBe(false)
    })

    it('parses markdown-wrapped JSON', async () => {
      mockComplete.mockResolvedValue(
        mockResponse('```json\n{"answer": "Yes", "confidence": 0.95, "needsReview": false}\n```')
      )

      const result = await generator.generateAnswer('Are you authorized?', sampleJob)
      expect(result.answer).toBe('Yes')
      expect(result.confidence).toBe(0.95)
    })

    it('returns fallback for garbage response', async () => {
      mockComplete.mockResolvedValue(mockResponse('This is not valid JSON response'))

      const result = await generator.generateAnswer('Question?', sampleJob)
      expect(result.confidence).toBe(0.3)
      expect(result.needsReview).toBe(true)
      expect(result.answer).toBeTruthy() // raw text used as fallback
    })

    it('clamps confidence to 0-1 range', async () => {
      mockComplete.mockResolvedValue(
        mockResponse(
          JSON.stringify({
            answer: 'Yes',
            confidence: 1.5,
            needsReview: false
          })
        )
      )

      const result = await generator.generateAnswer('Question?', sampleJob)
      expect(result.confidence).toBe(1)
    })
  })

  describe('generateAnswers()', () => {
    it('processes questions sequentially', async () => {
      mockComplete
        .mockResolvedValueOnce(
          mockResponse(JSON.stringify({ answer: 'Answer 1', confidence: 0.9, needsReview: false }))
        )
        .mockResolvedValueOnce(
          mockResponse(JSON.stringify({ answer: 'Answer 2', confidence: 0.8, needsReview: false }))
        )

      const results = await generator.generateAnswers(['Q1?', 'Q2?'], sampleJob)
      expect(results.size).toBe(2)
      expect(results.get('Q1?')?.answer).toBe('Answer 1')
      expect(results.get('Q2?')?.answer).toBe('Answer 2')
    })

    it('stores fallback on failure', async () => {
      mockComplete
        .mockResolvedValueOnce(
          mockResponse(
            JSON.stringify({ answer: 'Good answer', confidence: 0.9, needsReview: false })
          )
        )
        .mockRejectedValueOnce(new Error('API error'))

      const results = await generator.generateAnswers(['Q1?', 'Q2?'], sampleJob)
      expect(results.size).toBe(2)
      expect(results.get('Q1?')?.answer).toBe('Good answer')
      expect(results.get('Q2?')?.answer).toBe('')
      expect(results.get('Q2?')?.confidence).toBe(0)
      expect(results.get('Q2?')?.needsReview).toBe(true)
    })
  })
})
