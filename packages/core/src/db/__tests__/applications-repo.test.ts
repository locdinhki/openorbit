import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: ''
}))

const { ApplicationsRepo } = await import('../applications-repo')
const { JobsRepo } = await import('../jobs-repo')

beforeEach(() => {
  testDb = createTestDatabase()
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    externalId: `ext-${Math.random().toString(36).slice(2)}`,
    platform: 'linkedin',
    profileId: 'profile-1',
    url: 'https://linkedin.com/jobs/123',
    title: 'React Developer',
    company: 'Acme',
    location: 'Remote',
    jobType: 'full-time',
    description: 'Build things',
    postedDate: '2025-01-15',
    easyApply: true,
    status: 'new' as const,
    ...overrides
  }
}

describe('ApplicationsRepo', () => {
  let repo: InstanceType<typeof ApplicationsRepo>
  let jobsRepo: InstanceType<typeof JobsRepo>

  beforeEach(() => {
    repo = new ApplicationsRepo()
    jobsRepo = new JobsRepo()
  })

  describe('listApplied()', () => {
    it('returns only applied jobs', () => {
      const job1 = jobsRepo.insert(makeJob())
      jobsRepo.insert(makeJob())
      jobsRepo.updateStatus(job1.id, 'applied')

      const applied = repo.listApplied()
      expect(applied).toHaveLength(1)
      expect(applied[0].id).toBe(job1.id)
    })
  })

  describe('listApproved()', () => {
    it('returns only approved jobs', () => {
      const job1 = jobsRepo.insert(makeJob())
      jobsRepo.insert(makeJob())
      jobsRepo.updateStatus(job1.id, 'approved')

      const approved = repo.listApproved()
      expect(approved).toHaveLength(1)
      expect(approved[0].id).toBe(job1.id)
    })
  })

  describe('countAppliedToday()', () => {
    it('counts applications from today', () => {
      const job = jobsRepo.insert(makeJob())
      jobsRepo.updateStatus(job.id, 'applied')

      expect(repo.countAppliedToday()).toBe(1)
    })

    it('returns 0 when no applications', () => {
      expect(repo.countAppliedToday()).toBe(0)
    })
  })

  describe('countAppliedInSession()', () => {
    it('counts applications since session start', () => {
      const sessionStart = new Date().toISOString()
      const job = jobsRepo.insert(makeJob())
      jobsRepo.updateStatus(job.id, 'applied')

      expect(repo.countAppliedInSession(sessionStart)).toBe(1)
    })
  })

  describe('markApplied()', () => {
    it('transitions status and stores application details', () => {
      const job = jobsRepo.insert(makeJob())
      repo.markApplied(job.id, {
        applicationAnswers: { 'Why?': 'Great fit' },
        coverLetterUsed: 'Cover letter text',
        resumeUsed: 'resume.pdf'
      })

      const updated = jobsRepo.getById(job.id)!
      expect(updated.status).toBe('applied')
      expect(updated.applicationAnswers).toEqual({ 'Why?': 'Great fit' })
      expect(updated.coverLetterUsed).toBe('Cover letter text')
    })
  })
})
