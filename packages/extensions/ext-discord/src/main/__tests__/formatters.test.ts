import { describe, it, expect, vi } from 'vitest'
import type { JobListing, SearchProfile, ActionLog } from '@openorbit/core/types'
import {
  formatJobList,
  formatJobEmbed,
  formatJobDetail,
  jobActionRow,
  formatProfileList,
  formatActionLog,
  formatStatusSummary,
  chunkMessage
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
    expect(result.content).toContain('No jobs found')
    expect(result.embeds).toHaveLength(0)
    expect(result.components).toHaveLength(0)
  })

  it('formats job list with embeds and buttons', () => {
    const jobs = [
      makeJob({ title: 'Frontend Dev', company: 'Stripe', matchScore: 95 }),
      makeJob({ id: 'job-2', title: 'Backend Dev', company: 'Vercel', matchScore: 88 })
    ]
    const result = formatJobList(jobs, 'New Jobs')
    expect(result.content).toContain('New Jobs')
    expect(result.content).toContain('(2)')
    expect(result.embeds).toHaveLength(2)
    expect(result.components).toHaveLength(2)
  })

  it('uses **bold** in content', () => {
    const result = formatJobList([], 'New Jobs')
    expect(result.content).toMatch(/\*\*New Jobs\*\*/)
  })

  it('limits to 5 embeds', () => {
    const jobs = Array.from({ length: 8 }, (_, i) => makeJob({ id: `job-${i}`, title: `Job ${i}` }))
    const result = formatJobList(jobs, 'Jobs')
    expect(result.embeds.length).toBeLessThanOrEqual(5)
    expect(result.components.length).toBeLessThanOrEqual(5)
  })
})

describe('formatJobEmbed', () => {
  it('creates embed with job details', () => {
    const embed = formatJobEmbed(makeJob())
    const json = embed.toJSON()
    expect(json.title).toBe('Senior Engineer')
    expect(json.fields).toBeDefined()
    expect(json.fields!.some((f) => f.name === 'Company' && f.value === 'Acme Corp')).toBe(true)
  })

  it('includes index in title when provided', () => {
    const embed = formatJobEmbed(makeJob(), 0)
    expect(embed.toJSON().title).toBe('1. Senior Engineer')
  })

  it('includes match score field', () => {
    const embed = formatJobEmbed(makeJob({ matchScore: 95 }))
    const json = embed.toJSON()
    expect(json.fields!.some((f) => f.name === 'Match' && f.value === '95%')).toBe(true)
  })

  it('omits match score when undefined', () => {
    const embed = formatJobEmbed(makeJob({ matchScore: undefined }))
    const json = embed.toJSON()
    expect(json.fields!.some((f) => f.name === 'Match')).toBe(false)
  })
})

describe('formatJobDetail', () => {
  it('includes summary as description', () => {
    const embed = formatJobDetail(makeJob({ summary: 'Great role' }))
    expect(embed.toJSON().description).toBe('Great role')
  })

  it('includes highlights and red flags as fields', () => {
    const embed = formatJobDetail(makeJob({ highlights: 'Good pay', redFlags: 'Long hours' }))
    const json = embed.toJSON()
    expect(json.fields!.some((f) => f.name === 'Highlights')).toBe(true)
    expect(json.fields!.some((f) => f.name === 'Red Flags')).toBe(true)
  })
})

describe('jobActionRow', () => {
  it('creates approve and reject buttons', () => {
    const row = jobActionRow('job-1')
    const json = row.toJSON()
    expect(json.components).toHaveLength(2)
    expect(json.components[0].custom_id).toBe('approve:job-1')
    expect(json.components[1].custom_id).toBe('reject:job-1')
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
    expect(result).toContain('**SWE**')
    expect(result).toContain('**PM**')
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

describe('chunkMessage', () => {
  it('returns single chunk for short text', () => {
    expect(chunkMessage('Hello')).toEqual(['Hello'])
  })

  it('splits at paragraph boundary', () => {
    const text = 'A'.repeat(1200) + '\n\n' + 'B'.repeat(1200)
    const chunks = chunkMessage(text, 2000)
    expect(chunks.length).toBe(2)
    expect(chunks[0]).toBe('A'.repeat(1200))
    expect(chunks[1]).toBe('B'.repeat(1200))
  })

  it('hard splits when no paragraph boundary', () => {
    const text = 'A'.repeat(4000)
    const chunks = chunkMessage(text, 2000)
    expect(chunks.length).toBe(2)
    expect(chunks[0].length).toBe(2000)
  })

  it('handles exact maxLen', () => {
    const text = 'A'.repeat(2000)
    expect(chunkMessage(text)).toEqual([text])
  })
})
