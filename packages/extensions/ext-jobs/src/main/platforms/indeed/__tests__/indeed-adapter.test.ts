/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IndeedAdapter } from '../indeed-adapter'
import type { SearchProfile, JobListing } from '@openorbit/core/types'

const mockExtractJobCards = vi.fn().mockResolvedValue([])
const mockExtractJobDetails = vi.fn().mockResolvedValue({
  description: 'Test description',
  salary: '$100k'
})
const mockHumanClick = vi.fn().mockResolvedValue(undefined)
const mockDelay = vi.fn().mockResolvedValue(undefined)

vi.mock('../indeed-extractor', () => ({
  IndeedExtractor: class {
    extractJobCards = mockExtractJobCards
    extractJobDetails = mockExtractJobDetails
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
    name: 'Test Indeed',
    enabled: true,
    platform: 'indeed',
    search: {
      keywords: ['software engineer'],
      location: ['San Francisco, CA'],
      jobType: ['full-time'],
      experienceLevel: [],
      datePosted: 'pastWeek',
      remoteOnly: false,
      easyApplyOnly: false,
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

describe('IndeedAdapter', () => {
  let adapter: IndeedAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = new IndeedAdapter()
  })

  describe('platform metadata', () => {
    it('has correct platform name', () => {
      expect(adapter.platform).toBe('indeed')
    })

    it('has correct base URL', () => {
      expect(adapter.baseUrl).toBe('https://www.indeed.com')
    })
  })

  describe('isAuthenticated', () => {
    it('always returns true (Indeed does not require auth for search)', async () => {
      const result = await adapter.isAuthenticated({} as any)
      expect(result).toBe(true)
    })
  })

  describe('buildSearchUrl', () => {
    it('builds URL with keywords', () => {
      const profile = makeProfile({ keywords: ['react', 'typescript'] })
      const url = adapter.buildSearchUrl(profile)
      expect(url).toContain('q=react+typescript')
    })

    it('builds URL with location', () => {
      const profile = makeProfile({ location: ['New York, NY'] })
      const url = adapter.buildSearchUrl(profile)
      expect(url).toContain('l=New+York')
    })

    it('builds URL with date posted', () => {
      const profile = makeProfile({ datePosted: 'past24hrs' })
      const url = adapter.buildSearchUrl(profile)
      expect(url).toContain('fromage=1')
    })

    it('builds URL with past week', () => {
      const profile = makeProfile({ datePosted: 'pastWeek' })
      const url = adapter.buildSearchUrl(profile)
      expect(url).toContain('fromage=7')
    })

    it('builds URL with job type', () => {
      const profile = makeProfile({ jobType: ['contract'] })
      const url = adapter.buildSearchUrl(profile)
      expect(url).toContain('jt=contract')
    })

    it('builds URL with remote flag', () => {
      const profile = makeProfile({ remoteOnly: true })
      const url = adapter.buildSearchUrl(profile)
      expect(url).toContain('rbl=-1')
      expect(url).toContain('remotejob=')
    })

    it('builds URL starting with baseUrl', () => {
      const profile = makeProfile()
      const url = adapter.buildSearchUrl(profile)
      expect(url).toMatch(/^https:\/\/www\.indeed\.com\/jobs\?/)
    })
  })

  describe('extractListings', () => {
    it('delegates to IndeedExtractor and maps results', async () => {
      mockExtractJobCards.mockResolvedValueOnce([
        {
          externalId: 'abc123',
          title: 'Senior Dev',
          company: 'Acme',
          location: 'Remote',
          url: 'https://indeed.com/viewjob?jk=abc123'
        }
      ])

      const page = {} as any
      const listings = await adapter.extractListings(page)

      expect(mockExtractJobCards).toHaveBeenCalledWith(page)
      expect(listings).toHaveLength(1)
      expect(listings[0]).toEqual({
        externalId: 'abc123',
        platform: 'indeed',
        title: 'Senior Dev',
        company: 'Acme',
        location: 'Remote',
        url: 'https://indeed.com/viewjob?jk=abc123',
        easyApply: false
      })
    })

    it('sets easyApply to false for all listings', async () => {
      mockExtractJobCards.mockResolvedValueOnce([
        { externalId: 'x', title: 'Job', company: 'Co', location: '', url: '' }
      ])

      const listings = await adapter.extractListings({} as any)
      expect(listings[0].easyApply).toBe(false)
    })
  })

  describe('extractJobDetails', () => {
    it('navigates to URL if not already there', async () => {
      const mockGoto = vi.fn().mockResolvedValue(undefined)
      const page = {
        url: () => 'https://indeed.com/other',
        goto: mockGoto
      } as any

      await adapter.extractJobDetails(page, 'https://indeed.com/viewjob?jk=abc')

      expect(mockGoto).toHaveBeenCalledWith('https://indeed.com/viewjob?jk=abc', {
        waitUntil: 'domcontentloaded'
      })
    })

    it('returns description and salary from extractor', async () => {
      const page = { url: () => 'https://indeed.com/viewjob?jk=abc' } as any
      const result = await adapter.extractJobDetails(page, 'viewjob?jk=abc')

      expect(result.description).toBe('Test description')
      expect(result.salary).toBe('$100k')
    })
  })

  describe('applyToJob', () => {
    it('returns needsManualIntervention for all Indeed jobs', async () => {
      const job = { id: 'job-1', platform: 'indeed' } as JobListing
      const result = await adapter.applyToJob({} as any, job, {}, '')

      expect(result.success).toBe(false)
      expect(result.needsManualIntervention).toBe(true)
      expect(result.interventionReason).toContain('manual review')
    })
  })

  describe('getHints', () => {
    it('returns default empty hints when loader returns null', () => {
      const hints = adapter.getHints()
      expect(hints.site).toBe('indeed.com/jobs')
      expect(hints.actions).toEqual({})
    })
  })
})
