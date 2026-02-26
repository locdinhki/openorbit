import { describe, it, expect, vi } from 'vitest'
import type { JobListing, SearchProfile, ActionLog } from '@openorbit/core/types'
import {
  formatJobList,
  formatJobDetail,
  formatProfileList,
  formatActionLog,
  formatStatusSummary
} from '../formatters'

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeJob(overrides?: Partial<JobListing>): JobListing {
  return {
    id: 'job-1',
    externalId: 'ext-1',
    platform: 'linkedin',
    profileId: 'profile-1',
    url: 'https://linkedin.com/job/1',
    title: 'Senior Engineer',
    company: 'Acme Corp',
    location: 'Remote',
    jobType: 'Full-time',
    description: 'A great job',
    postedDate: '2025-01-01',
    easyApply: true,
    status: 'new',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    matchScore: 92,
    ...overrides
  }
}

function makeProfile(overrides?: Partial<SearchProfile>): SearchProfile {
  return {
    id: 'p-1',
    name: 'My Search',
    enabled: true,
    platform: 'linkedin' as unknown as SearchProfile['platform'],
    search: {},
    application: {},
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides
  } as SearchProfile
}

function makeActionLog(overrides?: Partial<ActionLog>): ActionLog {
  return {
    id: 'log-1',
    timestamp: '2025-01-01T10:00:00Z',
    site: 'linkedin',
    url: 'https://linkedin.com',
    intent: 'Click apply button',
    pageSnapshot: '',
    hintUsed: '',
    executionMethod: 'ai' as unknown as ActionLog['executionMethod'],
    actionType: 'click' as unknown as ActionLog['actionType'],
    actionTarget: 'button',
    actionValue: null,
    success: true,
    errorMessage: null,
    correctedTarget: null,
    correctedValue: null,
    ...overrides
  } as ActionLog
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('formatJobList', () => {
  it('formats empty list', () => {
    const result = formatJobList([], 'New Jobs')
    expect(result).toContain('No jobs found')
  })

  it('formats job list with details', () => {
    const jobs = [
      makeJob({ title: 'Frontend Dev', company: 'Stripe', matchScore: 95 }),
      makeJob({ id: 'job-2', title: 'Backend Dev', company: 'Vercel', matchScore: 88 })
    ]
    const result = formatJobList(jobs, 'New Jobs')
    expect(result).toContain('New Jobs')
    expect(result).toContain('(2)')
    expect(result).toContain('Frontend Dev')
    expect(result).toContain('Stripe')
    expect(result).toContain('95%')
  })

  it('uses *bold* formatting', () => {
    const jobs = [makeJob()]
    const result = formatJobList(jobs, 'Jobs')
    expect(result).toMatch(/\*Jobs\*/)
    expect(result).toMatch(/\*Senior Engineer\*/)
  })

  it('includes approve/reject hint', () => {
    const jobs = [makeJob()]
    const result = formatJobList(jobs, 'Jobs')
    expect(result).toContain('approve N')
    expect(result).toContain('reject N')
  })

  it('handles missing match score', () => {
    const jobs = [makeJob({ matchScore: undefined })]
    const result = formatJobList(jobs, 'Jobs')
    expect(result).not.toContain('Match:')
    expect(result).toContain('Senior Engineer')
  })
})

describe('formatJobDetail', () => {
  it('formats full job detail', () => {
    const job = makeJob({ summary: 'Great role', highlights: 'Good pay', redFlags: 'Long hours' })
    const result = formatJobDetail(job)
    expect(result).toContain('Senior Engineer')
    expect(result).toContain('Acme Corp')
    expect(result).toContain('Great role')
    expect(result).toContain('Good pay')
    expect(result).toContain('Long hours')
    expect(result).toContain('https://linkedin.com/job/1')
  })

  it('uses *bold* formatting for labels', () => {
    const result = formatJobDetail(makeJob({ summary: 'Test' }))
    expect(result).toMatch(/\*Senior Engineer\*/)
    expect(result).toMatch(/\*Summary:\*/)
  })
})

describe('formatProfileList', () => {
  it('formats empty list', () => {
    const result = formatProfileList([])
    expect(result).toContain('No profiles configured')
  })

  it('formats profiles with emoji and bold', () => {
    const profiles = [
      makeProfile({ name: 'SWE', enabled: true }),
      makeProfile({ id: 'p-2', name: 'PM', enabled: false })
    ]
    const result = formatProfileList(profiles)
    expect(result).toContain('\u2705')
    expect(result).toContain('\u274C')
    expect(result).toContain('*SWE*')
    expect(result).toContain('*PM*')
  })
})

describe('formatActionLog', () => {
  it('formats empty log', () => {
    const result = formatActionLog([])
    expect(result).toContain('No recent actions')
  })

  it('formats log entries with emoji status', () => {
    const entries = [
      makeActionLog({ intent: 'Applied to job', success: true }),
      makeActionLog({ id: 'log-2', intent: 'Login failed', success: false })
    ]
    const result = formatActionLog(entries)
    expect(result).toContain('\u2705')
    expect(result).toContain('\u274C')
    expect(result).toContain('Applied to job')
    expect(result).toContain('Login failed')
  })
})

describe('formatStatusSummary', () => {
  it('formats status with job counts', () => {
    const jobsRepo = {
      list: vi.fn().mockImplementation(({ status }) => {
        if (status === 'new') return [makeJob()]
        if (status === 'approved') return [makeJob(), makeJob()]
        return []
      })
    }
    const actionLogRepo = {
      getRecent: vi.fn().mockReturnValue([])
    }

    const result = formatStatusSummary(
      jobsRepo as unknown as Parameters<typeof formatStatusSummary>[0],
      actionLogRepo as unknown as Parameters<typeof formatStatusSummary>[1]
    )
    expect(result).toContain('Status Summary')
    expect(result).toContain('New jobs: 1')
    expect(result).toContain('Approved: 2')
    expect(result).toContain('Applied: 0')
  })

  it('handles errors gracefully', () => {
    const jobsRepo = {
      list: vi.fn().mockImplementation(() => {
        throw new Error('DB error')
      })
    }
    const actionLogRepo = { getRecent: vi.fn() }

    const result = formatStatusSummary(
      jobsRepo as unknown as Parameters<typeof formatStatusSummary>[0],
      actionLogRepo as unknown as Parameters<typeof formatStatusSummary>[1]
    )
    expect(result).toContain('Unable to retrieve status')
  })
})
