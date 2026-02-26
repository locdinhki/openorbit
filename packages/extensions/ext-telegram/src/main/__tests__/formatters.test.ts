// ============================================================================
// ext-telegram — Formatter Tests
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  formatJobList,
  formatJobDetail,
  formatProfileList,
  formatActionLog,
  jobInlineKeyboard
} from '../formatters'
import type { JobListing, SearchProfile, ActionLog } from '@openorbit/core/types'

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
    platform: 'linkedin',
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
    executionMethod: 'ai' as unknown,
    actionType: 'click' as unknown,
    actionTarget: 'button',
    actionValue: null,
    success: true,
    errorMessage: null,
    correctedTarget: null,
    correctedValue: null,
    ...overrides
  } as ActionLog
}

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
    expect(result).toContain('Backend Dev')
    expect(result).toContain('Vercel')
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
    const job = makeJob({
      title: 'Staff Engineer',
      company: 'Linear',
      salary: '$200-250k',
      summary: 'Great role with impact',
      highlights: ['Remote, equity'],
      redFlags: ['None']
    })
    const result = formatJobDetail(job)
    expect(result).toContain('Staff Engineer')
    expect(result).toContain('Linear')
    expect(result).toContain('$200-250k')
    expect(result).toContain('Great role with impact')
    expect(result).toContain('Remote, equity')
    expect(result).toContain('View Job')
  })
})

describe('formatProfileList', () => {
  it('formats empty list', () => {
    const result = formatProfileList([])
    expect(result).toContain('No profiles configured')
  })

  it('formats profile list', () => {
    const profiles = [
      makeProfile({ name: 'SWE Search', platform: 'linkedin', enabled: true }),
      makeProfile({ id: 'p-2', name: 'PM Search', platform: 'indeed', enabled: false })
    ]
    const result = formatProfileList(profiles)
    expect(result).toContain('SWE Search')
    expect(result).toContain('linkedin')
    expect(result).toContain('enabled')
    expect(result).toContain('PM Search')
    expect(result).toContain('disabled')
  })
})

describe('formatActionLog', () => {
  it('formats empty log', () => {
    const result = formatActionLog([])
    expect(result).toContain('No recent actions')
  })

  it('formats action entries', () => {
    const entries = [
      makeActionLog({ intent: 'Click apply button', success: true }),
      makeActionLog({ id: 'log-2', intent: 'Fill form field', success: false })
    ]
    const result = formatActionLog(entries)
    expect(result).toContain('Click apply button')
    expect(result).toContain('[OK]')
    expect(result).toContain('Fill form field')
    expect(result).toContain('[FAIL]')
  })
})

describe('jobInlineKeyboard', () => {
  it('creates approve/reject buttons', () => {
    const keyboard = jobInlineKeyboard('job-123')
    expect(keyboard).toEqual([
      [
        { text: 'Approve', callback_data: 'approve:job-123' },
        { text: 'Reject', callback_data: 'reject:job-123' }
      ]
    ])
  })
})
