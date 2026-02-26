import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIService, AICompletionResponse } from '../provider-types'
import type { JobListing, UpworkProjectDetails } from '../../types'

const mockComplete = vi.fn()

vi.mock('../claude-service', () => ({
  buildJobContext: vi.fn().mockReturnValue('## Job Context\nTest context')
}))

vi.mock('../memory-context', () => ({
  MemoryContextBuilder: class {
    buildAnswerContext = vi.fn().mockReturnValue('')
  }
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

const { ProposalGenerator } = await import('../proposal-generator')

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

function makeJob(overrides: Partial<JobListing> = {}): JobListing {
  return {
    id: 'job-1',
    externalId: 'ext-1',
    platform: 'upwork',
    profileId: 'prof-1',
    url: 'https://upwork.com/jobs/~abc',
    title: 'Build a React Dashboard',
    company: 'Acme Corp',
    location: 'Remote',
    description: 'We need a React developer to build a dashboard...',
    jobType: 'freelance',
    postedDate: '2025-01-01',
    easyApply: false,
    status: 'approved',
    createdAt: '',
    updatedAt: '',
    ...overrides
  }
}

describe('ProposalGenerator', () => {
  let generator: InstanceType<typeof ProposalGenerator>

  beforeEach(() => {
    vi.clearAllMocks()
    generator = new ProposalGenerator(createMockAI())
  })

  describe('generateProposal', () => {
    it('returns parsed proposal from valid JSON response', async () => {
      mockComplete.mockResolvedValueOnce(
        mockResponse(
          JSON.stringify({
            coverLetter: 'I noticed your project requires React expertise...',
            suggestedBid: 800,
            estimatedDuration: '2 weeks',
            confidence: 0.85,
            needsReview: false
          })
        )
      )

      const result = await generator.generateProposal(makeJob())

      expect(result.coverLetter).toContain('React expertise')
      expect(result.suggestedBid).toBe(800)
      expect(result.estimatedDuration).toBe('2 weeks')
      expect(result.confidence).toBe(0.85)
      expect(result.needsReview).toBe(false)
    })

    it('handles JSON wrapped in code fences', async () => {
      mockComplete.mockResolvedValueOnce(
        mockResponse(`\`\`\`json
{
  "coverLetter": "Great project!",
  "suggestedBid": 500,
  "estimatedDuration": "1 week",
  "confidence": 0.9,
  "needsReview": false
}
\`\`\``)
      )

      const result = await generator.generateProposal(makeJob())
      expect(result.coverLetter).toBe('Great project!')
      expect(result.suggestedBid).toBe(500)
    })

    it('handles null suggestedBid', async () => {
      mockComplete.mockResolvedValueOnce(
        mockResponse(
          JSON.stringify({
            coverLetter: 'Interested in your project.',
            suggestedBid: null,
            confidence: 0.7,
            needsReview: true
          })
        )
      )

      const result = await generator.generateProposal(makeJob())
      expect(result.suggestedBid).toBeNull()
      expect(result.estimatedDuration).toBeNull()
    })

    it('falls back to raw response when JSON parsing fails', async () => {
      mockComplete.mockResolvedValueOnce(
        mockResponse('This is not valid JSON but a decent proposal.')
      )

      const result = await generator.generateProposal(makeJob())
      expect(result.coverLetter).toContain('This is not valid JSON')
      expect(result.confidence).toBe(0.3)
      expect(result.needsReview).toBe(true)
    })

    it('clamps confidence between 0 and 1', async () => {
      mockComplete.mockResolvedValueOnce(
        mockResponse(
          JSON.stringify({
            coverLetter: 'Test',
            confidence: 1.5,
            needsReview: false
          })
        )
      )

      const result = await generator.generateProposal(makeJob())
      expect(result.confidence).toBe(1)
    })

    it('includes project details in the prompt when provided', async () => {
      mockComplete.mockResolvedValueOnce(
        mockResponse(
          JSON.stringify({
            coverLetter: 'With budget in mind...',
            suggestedBid: 3000,
            confidence: 0.8,
            needsReview: false
          })
        )
      )

      const details: UpworkProjectDetails = {
        budgetType: 'fixed',
        budgetFixed: 5000,
        timeline: '1 month',
        clientRating: 4.8,
        clientTotalSpent: '$50k+',
        experienceLevel: 'expert',
        skillsRequired: ['React', 'Node.js']
      }

      await generator.generateProposal(makeJob(), details)

      // Verify the request includes budget details in the user message
      expect(mockComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          task: 'generate_proposal',
          userMessage: expect.stringContaining('Budget type: fixed')
        })
      )
      const callArgs = mockComplete.mock.calls[0][0]
      expect(callArgs.userMessage).toContain('$5000')
      expect(callArgs.userMessage).toContain('React, Node.js')
    })

    it('throws when AI service fails', async () => {
      mockComplete.mockRejectedValueOnce(new Error('API quota exceeded'))

      await expect(generator.generateProposal(makeJob())).rejects.toThrow('API quota exceeded')
    })
  })
})
