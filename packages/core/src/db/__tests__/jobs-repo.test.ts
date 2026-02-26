import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: ''
}))

// Must import after mock setup
const { JobsRepo } = await import('../jobs-repo')

beforeEach(() => {
  testDb = createTestDatabase()
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    externalId: 'ext-123',
    platform: 'linkedin',
    profileId: 'profile-1',
    url: 'https://linkedin.com/jobs/123',
    title: 'Senior React Developer',
    company: 'Acme Corp',
    location: 'Remote',
    salary: '$150k-$180k',
    jobType: 'full-time',
    description: 'Build amazing things',
    postedDate: '2025-01-15',
    easyApply: true,
    status: 'new' as const,
    ...overrides
  }
}

describe('JobsRepo', () => {
  let repo: InstanceType<typeof JobsRepo>

  beforeEach(() => {
    repo = new JobsRepo()
  })

  describe('insert()', () => {
    it('creates a job with UUID and timestamps', () => {
      const job = repo.insert(makeJob())

      expect(job.id).toBeDefined()
      expect(job.id).toMatch(/^[0-9a-f-]{36}$/)
      expect(job.createdAt).toBeDefined()
      expect(job.updatedAt).toBeDefined()
      expect(job.title).toBe('Senior React Developer')
      expect(job.company).toBe('Acme Corp')
      expect(job.easyApply).toBe(true)
      expect(job.status).toBe('new')
    })

    it('maps all fields correctly from input', () => {
      const job = repo.insert(makeJob({ salary: '$200k', easyApply: false }))

      expect(job.salary).toBe('$200k')
      expect(job.easyApply).toBe(false)
      expect(job.externalId).toBe('ext-123')
      expect(job.platform).toBe('linkedin')
    })
  })

  describe('getById()', () => {
    it('returns null for nonexistent ID', () => {
      expect(repo.getById('nonexistent')).toBeNull()
    })

    it('returns correctly mapped job', () => {
      const inserted = repo.insert(makeJob())
      const found = repo.getById(inserted.id)

      expect(found).not.toBeNull()
      expect(found!.id).toBe(inserted.id)
      expect(found!.title).toBe('Senior React Developer')
    })
  })

  describe('getByExternalId()', () => {
    it('finds by external_id + platform combo', () => {
      repo.insert(makeJob())
      const found = repo.getByExternalId('ext-123', 'linkedin')

      expect(found).not.toBeNull()
      expect(found!.externalId).toBe('ext-123')
      expect(found!.platform).toBe('linkedin')
    })

    it('returns null for wrong platform', () => {
      repo.insert(makeJob())
      expect(repo.getByExternalId('ext-123', 'indeed')).toBeNull()
    })
  })

  describe('list()', () => {
    it('returns all jobs when no filters', () => {
      repo.insert(makeJob({ externalId: 'ext-1' }))
      repo.insert(makeJob({ externalId: 'ext-2' }))

      const jobs = repo.list()
      expect(jobs).toHaveLength(2)
    })

    it('filters by status string', () => {
      repo.insert(makeJob({ externalId: 'ext-1', status: 'new' }))
      repo.insert(makeJob({ externalId: 'ext-2', status: 'reviewed' }))

      const jobs = repo.list({ status: 'new' })
      expect(jobs).toHaveLength(1)
      expect(jobs[0].status).toBe('new')
    })

    it('filters by status array', () => {
      repo.insert(makeJob({ externalId: 'ext-1', status: 'new' }))
      repo.insert(makeJob({ externalId: 'ext-2', status: 'reviewed' }))
      repo.insert(makeJob({ externalId: 'ext-3', status: 'rejected' }))

      const jobs = repo.list({ status: ['new', 'reviewed'] })
      expect(jobs).toHaveLength(2)
    })

    it('filters by platform', () => {
      repo.insert(makeJob({ externalId: 'ext-1', platform: 'linkedin' }))
      repo.insert(makeJob({ externalId: 'ext-2', platform: 'indeed' }))

      const jobs = repo.list({ platform: 'linkedin' })
      expect(jobs).toHaveLength(1)
      expect(jobs[0].platform).toBe('linkedin')
    })

    it('filters by profileId', () => {
      repo.insert(makeJob({ externalId: 'ext-1', profileId: 'p1' }))
      repo.insert(makeJob({ externalId: 'ext-2', profileId: 'p2' }))

      const jobs = repo.list({ profileId: 'p1' })
      expect(jobs).toHaveLength(1)
    })

    it('filters by minScore', () => {
      const job1 = repo.insert(makeJob({ externalId: 'ext-1' }))
      const job2 = repo.insert(makeJob({ externalId: 'ext-2' }))
      repo.updateAnalysis(job1.id, {
        matchScore: 85,
        matchReasoning: '',
        summary: '',
        redFlags: [],
        highlights: []
      })
      repo.updateAnalysis(job2.id, {
        matchScore: 50,
        matchReasoning: '',
        summary: '',
        redFlags: [],
        highlights: []
      })

      const jobs = repo.list({ minScore: 70 })
      expect(jobs).toHaveLength(1)
      expect(jobs[0].matchScore).toBe(85)
    })

    it('respects limit and offset', () => {
      for (let i = 0; i < 5; i++) {
        repo.insert(makeJob({ externalId: `ext-${i}` }))
      }

      const page1 = repo.list({ limit: 2 })
      expect(page1).toHaveLength(2)

      const page2 = repo.list({ limit: 2, offset: 2 })
      expect(page2).toHaveLength(2)
      expect(page2[0].id).not.toBe(page1[0].id)
    })

    it('returns empty array when no matches', () => {
      const jobs = repo.list({ status: 'applied' })
      expect(jobs).toEqual([])
    })
  })

  describe('updateStatus()', () => {
    it('sets reviewed_at when status is reviewed', () => {
      const job = repo.insert(makeJob())
      repo.updateStatus(job.id, 'reviewed')

      const updated = repo.getById(job.id)!
      expect(updated.status).toBe('reviewed')
      expect(updated.reviewedAt).toBeDefined()
    })

    it('sets applied_at when status is applied', () => {
      const job = repo.insert(makeJob())
      repo.updateStatus(job.id, 'applied')

      const updated = repo.getById(job.id)!
      expect(updated.status).toBe('applied')
      expect(updated.appliedAt).toBeDefined()
    })

    it('sets updated_at to a valid ISO timestamp', () => {
      const job = repo.insert(makeJob())
      repo.updateStatus(job.id, 'approved')
      const updated = repo.getById(job.id)!

      // updated_at should be a valid ISO date string
      expect(updated.updatedAt).toBeDefined()
      expect(new Date(updated.updatedAt).toISOString()).toBe(updated.updatedAt)
    })
  })

  describe('updateAnalysis()', () => {
    it('serializes redFlags and highlights as JSON arrays', () => {
      const job = repo.insert(makeJob())
      repo.updateAnalysis(job.id, {
        matchScore: 85,
        matchReasoning: 'Great match',
        summary: 'A senior role',
        redFlags: ['Low pay', 'Vague description'],
        highlights: ['Remote', 'Good tech stack']
      })

      const updated = repo.getById(job.id)!
      expect(updated.matchScore).toBe(85)
      expect(updated.matchReasoning).toBe('Great match')
      expect(updated.summary).toBe('A senior role')
      expect(updated.redFlags).toEqual(['Low pay', 'Vague description'])
      expect(updated.highlights).toEqual(['Remote', 'Good tech stack'])
    })
  })

  describe('updateApplicationDetails()', () => {
    it('serializes applicationAnswers as JSON', () => {
      const job = repo.insert(makeJob())
      const answers = { 'Why this role?': 'Love the tech' }
      repo.updateApplicationDetails(job.id, {
        applicationAnswers: answers,
        coverLetterUsed: 'My cover letter',
        resumeUsed: 'resume.pdf'
      })

      const updated = repo.getById(job.id)!
      expect(updated.applicationAnswers).toEqual(answers)
      expect(updated.coverLetterUsed).toBe('My cover letter')
      expect(updated.resumeUsed).toBe('resume.pdf')
    })

    it('handles null optionals', () => {
      const job = repo.insert(makeJob())
      repo.updateApplicationDetails(job.id, {})

      const updated = repo.getById(job.id)!
      expect(updated.applicationAnswers).toBeUndefined()
      expect(updated.coverLetterUsed).toBeUndefined()
    })
  })

  describe('count()', () => {
    it('counts all jobs without filter', () => {
      repo.insert(makeJob({ externalId: 'ext-1' }))
      repo.insert(makeJob({ externalId: 'ext-2' }))

      expect(repo.count()).toBe(2)
    })

    it('counts jobs with status filter', () => {
      repo.insert(makeJob({ externalId: 'ext-1', status: 'new' }))
      repo.insert(makeJob({ externalId: 'ext-2', status: 'reviewed' }))

      expect(repo.count('new')).toBe(1)
      expect(repo.count('reviewed')).toBe(1)
    })
  })

  describe('exists()', () => {
    it('returns true for existing job', () => {
      repo.insert(makeJob())
      expect(repo.exists('ext-123', 'linkedin')).toBe(true)
    })

    it('returns false for nonexistent job', () => {
      expect(repo.exists('nonexistent', 'linkedin')).toBe(false)
    })
  })
})
