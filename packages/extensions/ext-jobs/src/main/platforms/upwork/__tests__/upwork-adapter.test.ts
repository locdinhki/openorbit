/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UpworkAdapter } from '../upwork-adapter'
import type { SearchProfile, JobListing } from '@openorbit/core/types'

const mockExtractJobCards = vi.fn().mockResolvedValue([])
const mockExtractJobDetails = vi.fn().mockResolvedValue({
  description: 'Build a React app',
  budgetInfo: '$500 - $1000',
  skills: ['React', 'TypeScript'],
  title: 'React Developer'
})
const mockGenerateProposal = vi.fn().mockResolvedValue({
  coverLetter: 'I am interested in your project...',
  suggestedBid: 750,
  estimatedDuration: '2 weeks',
  confidence: 0.85,
  needsReview: false
})
const mockHumanClick = vi.fn().mockResolvedValue(undefined)
const mockDelay = vi.fn().mockResolvedValue(undefined)

vi.mock('../upwork-extractor', () => ({
  UpworkExtractor: class {
    extractJobCards = mockExtractJobCards
    extractJobDetails = mockExtractJobDetails
  }
}))

vi.mock('@openorbit/core/ai/proposal-generator', () => ({
  ProposalGenerator: class {
    generateProposal = mockGenerateProposal
  }
}))

vi.mock('@openorbit/core/automation/human-behavior', () => ({
  HumanBehavior: class {
    humanClick = mockHumanClick
    delay = mockDelay
  }
}))

vi.mock('@openorbit/core/automation/skills-loader', () => ({
  SkillsLoader: class {
    loadSkill = vi.fn().mockReturnValue(null)
  }
}))

vi.mock('@openorbit/core/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

function makeProfile(overrides: Partial<SearchProfile['search']> = {}): SearchProfile {
  return {
    id: 'prof-1',
    name: 'Test Upwork',
    enabled: true,
    platform: 'upwork',
    search: {
      keywords: ['react developer'],
      location: [],
      jobType: ['freelance'],
      experienceLevel: [],
      datePosted: 'pastWeek',
      remoteOnly: true,
      excludeTerms: [],
      ...overrides
    },
    application: {
      resumeFile: '',
      defaultAnswers: {}
    },
    createdAt: '',
    updatedAt: ''
  }
}

describe('UpworkAdapter', () => {
  let adapter: UpworkAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new UpworkAdapter()
  })

  describe('platform metadata', () => {
    it('has correct platform name', () => {
      expect(adapter.platform).toBe('upwork')
    })

    it('has correct base URL', () => {
      expect(adapter.baseUrl).toBe('https://www.upwork.com')
    })
  })

  describe('buildSearchUrl', () => {
    it('builds URL with keywords', () => {
      const profile = makeProfile({ keywords: ['react', 'node'] })
      const url = adapter.buildSearchUrl(profile)
      expect(url).toContain('q=react+node')
    })

    it('includes sort by recency', () => {
      const profile = makeProfile()
      const url = adapter.buildSearchUrl(profile)
      expect(url).toContain('sort=recency')
    })

    it('builds URL starting with baseUrl', () => {
      const profile = makeProfile()
      const url = adapter.buildSearchUrl(profile)
      expect(url).toMatch(/^https:\/\/www\.upwork\.com\/nx\/search\/jobs\//)
    })
  })

  describe('extractListings', () => {
    it('delegates to UpworkExtractor and maps results', async () => {
      mockExtractJobCards.mockResolvedValueOnce([
        {
          externalId: 'abc123',
          title: 'Build React App',
          clientName: 'Acme Corp',
          url: 'https://www.upwork.com/jobs/~abc123',
          snippet: 'Need a React developer...'
        }
      ])

      const page = {} as any
      const listings = await adapter.extractListings(page)

      expect(listings).toHaveLength(1)
      expect(listings[0].platform).toBe('upwork')
      expect(listings[0].company).toBe('Acme Corp')
      expect(listings[0].easyApply).toBe(false)
      expect(listings[0].location).toBe('Remote')
    })
  })

  describe('extractJobDetails', () => {
    it('returns description and budget from extractor', async () => {
      const page = { url: () => 'https://upwork.com/jobs/~abc123' } as any
      const result = await adapter.extractJobDetails(page, 'jobs/~abc123')

      expect(result.description).toBe('Build a React app')
      expect(result.salary).toBe('$500 - $1000')
    })
  })

  describe('applyToJob', () => {
    it('generates proposal and returns manual intervention', async () => {
      const job = { id: 'job-1', title: 'React Dev', platform: 'upwork' } as JobListing
      const onProgress = vi.fn()
      const result = await adapter.applyToJob({} as any, job, {}, '', onProgress)

      expect(result.success).toBe(false)
      expect(result.needsManualIntervention).toBe(true)
      expect(result.coverLetterUsed).toContain('I am interested')
      expect(result.interventionReason).toContain('confidence: 85%')
      expect(result.interventionReason).toContain('$750')
      expect(onProgress).toHaveBeenCalledTimes(2)
    })

    it('handles proposal generation failure gracefully', async () => {
      mockGenerateProposal.mockRejectedValueOnce(new Error('API error'))
      const job = { id: 'job-1', platform: 'upwork' } as JobListing
      const result = await adapter.applyToJob({} as any, job, {}, '')

      expect(result.success).toBe(false)
      expect(result.needsManualIntervention).toBe(true)
      expect(result.interventionReason).toContain('Failed to generate proposal')
    })
  })

  describe('getHints', () => {
    it('returns default empty hints when loader returns null', () => {
      const hints = adapter.getHints()
      expect(hints.site).toBe('upwork.com/jobs')
      expect(hints.actions).toEqual({})
    })
  })
})
