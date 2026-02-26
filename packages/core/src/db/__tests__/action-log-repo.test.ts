import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: ''
}))

const { ActionLogRepo } = await import('../action-log-repo')

beforeEach(() => {
  testDb = createTestDatabase()
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeActionLog(overrides: Record<string, unknown> = {}) {
  return {
    site: 'linkedin.com',
    url: 'https://linkedin.com/jobs/123',
    intent: 'click_apply',
    pageSnapshot: '<html>...</html>',
    hintUsed: {
      intent: 'click_apply',
      hint: {
        selectors: ['.apply-btn'],
        textMatches: ['Apply'],
        ariaLabels: ['Apply now'],
        location: 'job-detail',
        elementType: 'button'
      },
      fallbackDescription: 'Click the apply button',
      lastVerified: '2025-01-01',
      confidence: 0.9,
      failureCount: 0
    },
    executionMethod: 'hint' as const,
    action: {
      type: 'click' as const,
      target: '.apply-btn'
    },
    success: true,
    ...overrides
  }
}

describe('ActionLogRepo', () => {
  let repo: InstanceType<typeof ActionLogRepo>

  beforeEach(() => {
    repo = new ActionLogRepo()
  })

  describe('insert()', () => {
    it('creates a log entry with ID and timestamp', () => {
      const log = repo.insert(makeActionLog())

      expect(log.id).toBeDefined()
      expect(log.timestamp).toBeDefined()
      expect(log.site).toBe('linkedin.com')
      expect(log.success).toBe(true)
      expect(log.action.type).toBe('click')
      expect(log.action.target).toBe('.apply-btn')
    })

    it('handles error messages', () => {
      const log = repo.insert(makeActionLog({ success: false, errorMessage: 'Element not found' }))

      expect(log.success).toBe(false)
      expect(log.errorMessage).toBe('Element not found')
    })
  })

  describe('list()', () => {
    it('returns logs ordered by timestamp DESC', () => {
      repo.insert(makeActionLog({ site: 'linkedin.com' }))
      repo.insert(makeActionLog({ site: 'indeed.com' }))

      const logs = repo.list()
      expect(logs).toHaveLength(2)
    })

    it('filters by site', () => {
      repo.insert(makeActionLog({ site: 'linkedin.com' }))
      repo.insert(makeActionLog({ site: 'indeed.com' }))

      const logs = repo.list({ site: 'linkedin.com' })
      expect(logs).toHaveLength(1)
      expect(logs[0].site).toBe('linkedin.com')
    })

    it('filters by success', () => {
      repo.insert(makeActionLog({ success: true }))
      repo.insert(makeActionLog({ success: false }))

      const successes = repo.list({ success: true })
      expect(successes).toHaveLength(1)
      expect(successes[0].success).toBe(true)
    })
  })

  describe('getRecent()', () => {
    it('respects limit', () => {
      for (let i = 0; i < 5; i++) {
        repo.insert(makeActionLog())
      }

      const recent = repo.getRecent(3)
      expect(recent).toHaveLength(3)
    })
  })

  describe('addCorrection()', () => {
    it('updates corrected fields', () => {
      const log = repo.insert(makeActionLog())
      repo.addCorrection(log.id, { target: '.correct-btn', value: 'Apply Now' })

      // Fetch from DB to verify
      const logs = repo.list()
      const updated = logs.find((l) => l.id === log.id)!
      expect(updated.correctedAction).toBeDefined()
      expect(updated.correctedAction!.target).toBe('.correct-btn')
      expect(updated.correctedAction!.value).toBe('Apply Now')
    })
  })

  describe('getTrainingData()', () => {
    it('returns successful entries and entries with corrections', () => {
      repo.insert(makeActionLog({ success: true }))
      const failed = repo.insert(makeActionLog({ success: false }))
      repo.addCorrection(failed.id, { target: '.fixed-btn' })
      repo.insert(makeActionLog({ success: false })) // no correction

      const training = repo.getTrainingData()
      expect(training).toHaveLength(2) // success=true + has correction
    })
  })

  describe('count()', () => {
    it('returns total count', () => {
      repo.insert(makeActionLog())
      repo.insert(makeActionLog())
      repo.insert(makeActionLog())

      expect(repo.count()).toBe(3)
    })

    it('returns 0 when empty', () => {
      expect(repo.count()).toBe(0)
    })
  })
})
