// ============================================================================
// ext-discord — AI Gateway Tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock discord.js (needed by formatters)
vi.mock('discord.js', () => {
  const EmbedBuilder = vi.fn().mockImplementation(() => {
    const instance: Record<string, unknown> = {
      data: {},
      setTitle: vi.fn().mockReturnThis(),
      setColor: vi.fn().mockReturnThis(),
      setURL: vi.fn().mockReturnThis(),
      setDescription: vi.fn().mockReturnThis(),
      addFields: vi.fn().mockReturnThis(),
      toJSON: vi.fn().mockReturnValue({ title: 'test', fields: [] })
    }
    return instance
  })
  return {
    EmbedBuilder,
    ActionRowBuilder: vi.fn().mockImplementation(() => ({
      addComponents: vi.fn().mockReturnThis(),
      toJSON: vi.fn().mockReturnValue({ components: [] })
    })),
    ButtonBuilder: vi.fn().mockImplementation(() => ({
      setCustomId: vi.fn().mockReturnThis(),
      setLabel: vi.fn().mockReturnThis(),
      setStyle: vi.fn().mockReturnThis()
    })),
    ButtonStyle: { Success: 3, Danger: 4 },
    SlashCommandBuilder: vi.fn().mockImplementation(() => ({
      setName: vi.fn().mockReturnThis(),
      setDescription: vi.fn().mockReturnThis(),
      toJSON: vi.fn().mockReturnValue({ name: 'test', description: 'test' })
    }))
  }
})

// Mock the Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn()
}))

// Mock memory modules
const mockGetByCategory = vi.fn().mockReturnValue([])
const mockSearch = vi.fn().mockReturnValue([])
const mockAddFact = vi.fn(
  (category: string, content: string, source: string, confidence: number) => ({
    id: `fact-${Date.now()}`,
    category,
    content,
    source,
    confidence,
    metadata: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    accessedAt: '2025-01-01',
    accessCount: 0
  })
)

vi.mock('@openorbit/core/db/memory-repo', () => ({
  MemoryRepo: class {
    addFact = mockAddFact
    getByCategory = mockGetByCategory
    search = mockSearch
    listAll = vi.fn().mockReturnValue([])
    getById = vi.fn()
    updateFact = vi.fn()
    deleteFact = vi.fn()
    getRecentFacts = vi.fn().mockReturnValue([])
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

// Mock ext-jobs repos
vi.mock('@openorbit/ext-jobs/main/db/jobs-repo', () => {
  return {
    JobsRepo: class MockJobsRepo {
      list = vi.fn().mockReturnValue([
        {
          id: 'job-1',
          title: 'Frontend Engineer',
          company: 'Stripe',
          platform: 'linkedin',
          location: 'Remote',
          salary: '$180k',
          jobType: 'Full-time',
          status: 'new',
          matchScore: 92,
          url: 'https://linkedin.com/job/1',
          description: 'Great job',
          postedDate: '2025-01-01',
          easyApply: true,
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01'
        }
      ])
      getById = vi.fn().mockReturnValue({
        id: 'job-1',
        title: 'Frontend Engineer',
        company: 'Stripe',
        status: 'approved'
      })
      updateStatus = vi.fn()
    }
  }
})

vi.mock('@openorbit/ext-jobs/main/db/profiles-repo', () => {
  return {
    ProfilesRepo: class MockProfilesRepo {
      list = vi
        .fn()
        .mockReturnValue([{ id: 'p-1', name: 'SWE', platform: 'linkedin', enabled: true }])
    }
  }
})

vi.mock('@openorbit/ext-jobs/main/db/action-log-repo', () => {
  return {
    ActionLogRepo: class MockActionLogRepo {
      getRecent = vi.fn().mockReturnValue([])
    }
  }
})

vi.mock('@openorbit/ext-jobs/main/db/applications-repo', () => {
  return {
    ApplicationsRepo: class MockApplicationsRepo {
      listApplied = vi.fn().mockReturnValue([])
    }
  }
})

import { AIGateway } from '../ai-gateway'
import { query } from '@anthropic-ai/claude-agent-sdk'
import type Database from 'better-sqlite3'

const mockDb = {} as Database.Database
const mockLog = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

describe('AIGateway', () => {
  let gateway: AIGateway

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = new AIGateway({ db: mockDb, log: mockLog })
  })

  // -------------------------------------------------------------------------
  // Direct commands
  // -------------------------------------------------------------------------

  describe('direct commands', () => {
    it('handles /jobs command', async () => {
      const result = await gateway.handleMessage('/jobs')
      expect(result).toContain('Frontend Engineer')
      expect(result).toContain('Stripe')
    })

    it('handles /profiles command', async () => {
      const result = await gateway.handleMessage('/profiles')
      expect(result).toContain('SWE')
      expect(result).toContain('linkedin')
    })

    it('handles /help command', async () => {
      const result = await gateway.handleMessage('/help')
      expect(result).toContain('OpenOrbit Commands')
      expect(result).toContain('/jobs')
      expect(result).toContain('/profiles')
      expect(result).toContain('/status')
    })

    it('handles /status command', async () => {
      const result = await gateway.handleMessage('/status')
      expect(result).toContain('Status Summary')
    })

    it('handles "new jobs" shortcut', async () => {
      const result = await gateway.handleMessage('new jobs')
      expect(result).toContain('Frontend Engineer')
    })

    it('handles "approve N" text command', async () => {
      const result = await gateway.handleMessage('approve 1')
      expect(result).toContain('Approved')
      expect(result).toContain('Frontend Engineer')
    })

    it('handles "reject N" text command', async () => {
      const result = await gateway.handleMessage('reject 1')
      expect(result).toContain('Rejected')
    })

    it('returns not found for invalid approve index', async () => {
      const result = await gateway.handleMessage('approve 99')
      expect(result).toContain('not found')
    })

    it('uses **bold** formatting in help', async () => {
      const result = await gateway.handleMessage('/help')
      expect(result).toMatch(/\*\*OpenOrbit Commands\*\*/)
    })
  })

  // -------------------------------------------------------------------------
  // AI processing
  // -------------------------------------------------------------------------

  describe('AI processing', () => {
    it('falls back to AI for natural language', async () => {
      const mockQuery = query as ReturnType<typeof vi.fn>
      mockQuery.mockReturnValue(
        (async function* () {
          yield {
            type: 'result',
            subtype: 'success',
            result: 'You have 1 new job: Frontend Engineer at Stripe with 92% match.',
            usage: { input_tokens: 100, output_tokens: 50 },
            modelUsage: {}
          }
        })()
      )

      const result = await gateway.handleMessage('any interesting jobs today?')
      expect(result).toContain('Frontend Engineer')
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'any interesting jobs today?',
          options: expect.objectContaining({
            model: 'sonnet',
            maxTurns: 1
          })
        })
      )
    })

    it('handles AI errors gracefully', async () => {
      const mockQuery = query as ReturnType<typeof vi.fn>
      mockQuery.mockReturnValue(
        (async function* () {
          yield {
            type: 'result',
            subtype: 'error',
            errors: ['Auth failed']
          }
        })()
      )

      const result = await gateway.handleMessage('what jobs are good?')
      expect(result).toContain('error')
    })

    it('handles query exceptions', async () => {
      const mockQuery = query as ReturnType<typeof vi.fn>
      mockQuery.mockImplementation(() => {
        throw new Error('SDK not available')
      })

      const result = await gateway.handleMessage('tell me about jobs')
      expect(result).toContain('something went wrong')
    })

    it('strips CLAUDECODE env var', async () => {
      process.env.CLAUDECODE = '1'

      const mockQuery = query as ReturnType<typeof vi.fn>
      mockQuery.mockReturnValue(
        (async function* () {
          yield { type: 'result', subtype: 'success', result: 'ok', usage: {}, modelUsage: {} }
        })()
      )

      await gateway.handleMessage('summarize my search')

      const callArgs = mockQuery.mock.calls[0][0]
      expect(callArgs.options.env).not.toHaveProperty('CLAUDECODE')

      delete process.env.CLAUDECODE
    })
  })

  // -------------------------------------------------------------------------
  // Callback processing
  // -------------------------------------------------------------------------

  describe('callback processing', () => {
    it('approves a job', async () => {
      const result = await gateway.processCallback('approve:job-1')
      expect(result).toContain('Approved')
      expect(result).toContain('Frontend Engineer')
    })

    it('rejects a job', async () => {
      const result = await gateway.processCallback('reject:job-1')
      expect(result).toContain('Rejected')
    })

    it('handles invalid callback data', async () => {
      const result = await gateway.processCallback('invalid')
      expect(result).toContain('Invalid action')
    })

    it('handles unknown action', async () => {
      const result = await gateway.processCallback('delete:job-1')
      expect(result).toContain('Unknown action')
    })

    it('uses **bold** in callback responses', async () => {
      const result = await gateway.processCallback('approve:job-1')
      expect(result).toMatch(/\*\*Frontend Engineer\*\*/)
    })
  })

  // -------------------------------------------------------------------------
  // Memory integration
  // -------------------------------------------------------------------------

  describe('memory integration', () => {
    it('strips memory tags from AI response', async () => {
      const mockQuery = query as ReturnType<typeof vi.fn>
      mockQuery.mockReturnValue(
        (async function* () {
          yield {
            type: 'result',
            subtype: 'success',
            result: 'Got it! <memory category="preference">Only wants remote roles</memory>',
            usage: {},
            modelUsage: {}
          }
        })()
      )

      const result = await gateway.handleMessage('I only want remote roles')
      expect(result).not.toContain('<memory')
      expect(result).toBe('Got it!')
    })

    it('saves extracted memory facts', async () => {
      const mockQuery = query as ReturnType<typeof vi.fn>
      mockQuery.mockReturnValue(
        (async function* () {
          yield {
            type: 'result',
            subtype: 'success',
            result: 'Noted. <memory category="preference">Minimum salary $150k</memory>',
            usage: {},
            modelUsage: {}
          }
        })()
      )

      await gateway.handleMessage('I need at least 150k')
      expect(mockAddFact).toHaveBeenCalledWith('preference', 'Minimum salary $150k', 'chat', 0.8)
    })

    it('injects memory context into system prompt', async () => {
      mockGetByCategory.mockReturnValue([
        {
          id: 'f1',
          category: 'preference',
          content: 'Prefers remote',
          source: 'user',
          confidence: 1.0,
          metadata: {},
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
          accessedAt: '2025-01-01',
          accessCount: 0
        }
      ])

      const mockQuery = query as ReturnType<typeof vi.fn>
      mockQuery.mockReturnValue(
        (async function* () {
          yield {
            type: 'result',
            subtype: 'success',
            result: 'Here are remote jobs.',
            usage: {},
            modelUsage: {}
          }
        })()
      )

      await gateway.handleMessage('show me good jobs')

      const callArgs = mockQuery.mock.calls[0][0]
      expect(callArgs.options.systemPrompt).toContain('Memory Context')
      expect(callArgs.options.systemPrompt).toContain('Prefers remote')
    })
  })
})
