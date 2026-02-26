import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: ''
}))

const { withTransaction } = await import('../transaction')
const { JobsRepo } = await import('../jobs-repo')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeJob(externalId: string) {
  return {
    externalId,
    platform: 'linkedin',
    profileId: 'profile-1',
    url: `https://linkedin.com/jobs/${externalId}`,
    title: 'Developer',
    company: 'Acme',
    location: 'Remote',
    jobType: 'full-time',
    description: 'Build things',
    postedDate: '2025-01-15',
    easyApply: true,
    status: 'new' as const
  }
}

describe('withTransaction', () => {
  beforeEach(() => {
    testDb = createTestDatabase()
  })

  it('commits all changes on success', () => {
    const repo = new JobsRepo()

    withTransaction(() => {
      repo.insert(makeJob('tx-1'))
      repo.insert(makeJob('tx-2'))
    })

    expect(repo.count()).toBe(2)
  })

  it('rolls back all changes on error', () => {
    const repo = new JobsRepo()

    expect(() => {
      withTransaction(() => {
        repo.insert(makeJob('tx-1'))
        repo.insert(makeJob('tx-2'))
        throw new Error('Simulated failure')
      })
    }).toThrow('Simulated failure')

    expect(repo.count()).toBe(0)
  })

  it('returns the function result', () => {
    const result = withTransaction(() => {
      return 'hello'
    })

    expect(result).toBe('hello')
  })
})
