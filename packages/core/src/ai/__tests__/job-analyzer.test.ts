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

const { JobAnalyzer } = await import('../job-analyzer')

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
  description: 'Build amazing React apps',
  postedDate: '2025-01-15',
  easyApply: true,
  status: 'new' as const,
  createdAt: '2025-01-15T00:00:00Z',
  updatedAt: '2025-01-15T00:00:00Z'
}

describe('JobAnalyzer', () => {
  let analyzer: InstanceType<typeof JobAnalyzer>

  beforeEach(() => {
    analyzer = new JobAnalyzer(createMockAI())
    vi.clearAllMocks()
  })

  describe('analyze()', () => {
    it('parses clean JSON response', async () => {
      mockComplete.mockResolvedValue(
        mockResponse(
          JSON.stringify({
            matchScore: 85,
            reasoning: 'Great match for React expertise',
            summary: 'Senior React role at a good company',
            redFlags: ['No salary listed'],
            highlights: ['Remote', 'React focus'],
            recommendedResume: 'react-resume'
          })
        )
      )

      const result = await analyzer.analyze(sampleJob)

      expect(result.matchScore).toBe(85)
      expect(result.reasoning).toBe('Great match for React expertise')
      expect(result.redFlags).toEqual(['No salary listed'])
      expect(result.highlights).toEqual(['Remote', 'React focus'])
    })

    it('parses markdown-wrapped JSON', async () => {
      mockComplete.mockResolvedValue(
        mockResponse(
          '```json\n{"matchScore": 75, "reasoning": "Good fit", "summary": "Dev role", "redFlags": [], "highlights": ["Remote"], "recommendedResume": "default"}\n```'
        )
      )

      const result = await analyzer.analyze(sampleJob)
      expect(result.matchScore).toBe(75)
      expect(result.reasoning).toBe('Good fit')
    })

    it('returns fallback for garbage input', async () => {
      mockComplete.mockResolvedValue(mockResponse('This is not JSON at all, just some random text'))

      const result = await analyzer.analyze(sampleJob)
      expect(result.matchScore).toBe(50)
      expect(result.summary).toBe('Analysis parsing failed — review manually')
      expect(result.redFlags).toContain('Could not parse AI analysis')
    })

    it('clamps score above 100', async () => {
      mockComplete.mockResolvedValue(
        mockResponse(
          JSON.stringify({
            matchScore: 150,
            reasoning: 'Perfect',
            summary: 'Great',
            redFlags: [],
            highlights: [],
            recommendedResume: 'default'
          })
        )
      )

      const result = await analyzer.analyze(sampleJob)
      expect(result.matchScore).toBe(100)
    })

    it('clamps negative score to 0', async () => {
      mockComplete.mockResolvedValue(
        mockResponse(
          JSON.stringify({
            matchScore: -10,
            reasoning: 'Bad',
            summary: 'Bad fit',
            redFlags: [],
            highlights: [],
            recommendedResume: 'default'
          })
        )
      )

      const result = await analyzer.analyze(sampleJob)
      expect(result.matchScore).toBe(0)
    })
  })

  describe('analyzeBatch()', () => {
    it('continues on individual failures', async () => {
      mockComplete
        .mockResolvedValueOnce(
          mockResponse(
            JSON.stringify({
              matchScore: 80,
              reasoning: 'Good',
              summary: 'Good role',
              redFlags: [],
              highlights: [],
              recommendedResume: 'default'
            })
          )
        )
        .mockRejectedValueOnce(new Error('API timeout'))
        .mockResolvedValueOnce(
          mockResponse(
            JSON.stringify({
              matchScore: 60,
              reasoning: 'OK',
              summary: 'OK role',
              redFlags: [],
              highlights: [],
              recommendedResume: 'default'
            })
          )
        )

      const jobs = [
        { ...sampleJob, id: 'job-1' },
        { ...sampleJob, id: 'job-2' },
        { ...sampleJob, id: 'job-3' }
      ]

      const results = await analyzer.analyzeBatch(jobs)
      expect(results.size).toBe(2) // job-2 failed
      expect(results.has('job-1')).toBe(true)
      expect(results.has('job-3')).toBe(true)
      expect(results.has('job-2')).toBe(false)
    })

    it('calls onProgress callback', async () => {
      mockComplete.mockResolvedValue(
        mockResponse(
          JSON.stringify({
            matchScore: 80,
            reasoning: 'Good',
            summary: 'Good',
            redFlags: [],
            highlights: [],
            recommendedResume: 'default'
          })
        )
      )

      const onProgress = vi.fn()
      await analyzer.analyzeBatch([sampleJob], onProgress)

      expect(onProgress).toHaveBeenCalledWith(0, 1)
    })
  })
})
