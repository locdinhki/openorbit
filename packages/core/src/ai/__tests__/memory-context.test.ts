import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetByCategory = vi.fn().mockReturnValue([])
const mockSearch = vi.fn().mockReturnValue([])

vi.mock('../../db/memory-repo', () => ({
  MemoryRepo: class {
    getByCategory = mockGetByCategory
    search = mockSearch
  }
}))

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

const { MemoryContextBuilder } = await import('../memory-context')

function makeFact(overrides: Record<string, unknown> = {}): {
  id: string
  category: string
  content: string
  source: string
  confidence: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  accessedAt: string
  accessCount: number
} {
  return {
    id: 'fact-1',
    category: 'preference',
    content: 'Prefers remote work',
    source: 'user',
    confidence: 1.0,
    metadata: {},
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    accessedAt: '2025-01-01',
    accessCount: 0,
    ...overrides
  }
}

describe('MemoryContextBuilder', () => {
  let builder: InstanceType<typeof MemoryContextBuilder>

  beforeEach(() => {
    builder = new MemoryContextBuilder()
    vi.clearAllMocks()
    mockGetByCategory.mockReturnValue([])
    mockSearch.mockReturnValue([])
  })

  describe('buildJobAnalysisContext()', () => {
    it('returns empty string when no memory facts exist', () => {
      const ctx = builder.buildJobAnalysisContext('React Developer', 'Acme')
      expect(ctx).toBe('')
    })

    it('includes user preferences section', () => {
      mockGetByCategory.mockReturnValue([makeFact({ content: 'Prefers remote work' })])

      const ctx = builder.buildJobAnalysisContext('React Developer', 'Acme')
      expect(ctx).toContain('## Memory Context')
      expect(ctx).toContain('### User Preferences')
      expect(ctx).toContain('Prefers remote work')
    })

    it('includes company facts when found', () => {
      mockSearch.mockImplementation((_query: string, opts: { category?: string }) => {
        if (opts?.category === 'company') {
          return [
            {
              fact: makeFact({ category: 'company', content: 'Acme has remote culture' }),
              score: 1.0
            }
          ]
        }
        return []
      })

      const ctx = builder.buildJobAnalysisContext('React Developer', 'Acme')
      expect(ctx).toContain('Known Facts About Acme')
      expect(ctx).toContain('Acme has remote culture')
    })

    it('includes pattern matches for job title', () => {
      mockSearch.mockImplementation((_query: string, opts: { category?: string }) => {
        if (opts?.category === 'pattern') {
          return [
            {
              fact: makeFact({ category: 'pattern', content: 'User rejected 5 DevOps roles' }),
              score: 0.8
            }
          ]
        }
        return []
      })

      const ctx = builder.buildJobAnalysisContext('DevOps Engineer', 'Acme')
      expect(ctx).toContain('Relevant Patterns')
      expect(ctx).toContain('User rejected 5 DevOps roles')
    })

    it('combines all sections', () => {
      mockGetByCategory.mockReturnValue([makeFact({ content: 'Prefers $150k+' })])
      mockSearch.mockImplementation((_query: string, opts: { category?: string }) => {
        if (opts?.category === 'company') {
          return [{ fact: makeFact({ category: 'company', content: 'Good reviews' }), score: 1.0 }]
        }
        if (opts?.category === 'pattern') {
          return [
            { fact: makeFact({ category: 'pattern', content: 'Likes React roles' }), score: 0.8 }
          ]
        }
        return []
      })

      const ctx = builder.buildJobAnalysisContext('React Developer', 'Acme')
      expect(ctx).toContain('User Preferences')
      expect(ctx).toContain('Known Facts About Acme')
      expect(ctx).toContain('Relevant Patterns')
    })
  })

  describe('buildAnswerContext()', () => {
    it('returns empty string when no memory facts exist', () => {
      const ctx = builder.buildAnswerContext('Why do you want this role?', 'Acme')
      expect(ctx).toBe('')
    })

    it('includes past answers section', () => {
      mockSearch.mockImplementation((_query: string, opts: { category?: string }) => {
        if (opts?.category === 'answer') {
          return [
            {
              fact: makeFact({ category: 'answer', content: 'I am passionate about building UIs' }),
              score: 1.0
            }
          ]
        }
        return []
      })

      const ctx = builder.buildAnswerContext('Why do you want this role?', 'Acme')
      expect(ctx).toContain('Past Answers to Similar Questions')
      expect(ctx).toContain('passionate about building UIs')
    })

    it('includes company facts and preferences', () => {
      mockSearch.mockImplementation((_query: string, opts: { category?: string }) => {
        if (opts?.category === 'company') {
          return [
            { fact: makeFact({ category: 'company', content: 'Acme uses React' }), score: 1.0 }
          ]
        }
        if (opts?.category === 'preference') {
          return [{ fact: makeFact({ content: 'Prefers frontend roles' }), score: 0.5 }]
        }
        return []
      })

      const ctx = builder.buildAnswerContext('Tell us about yourself', 'Acme')
      expect(ctx).toContain('Known Facts About Acme')
      expect(ctx).toContain('Relevant Preferences')
    })
  })

  describe('buildChatContext()', () => {
    it('returns empty string when no memory facts exist', () => {
      const ctx = builder.buildChatContext('any new jobs?')
      expect(ctx).toBe('')
    })

    it('includes user preferences section', () => {
      mockGetByCategory.mockReturnValue([
        makeFact({ content: 'Only wants remote roles' }),
        makeFact({ id: 'fact-2', content: 'Minimum salary $150k' })
      ])

      const ctx = builder.buildChatContext('any new jobs?')
      expect(ctx).toContain('## Memory Context')
      expect(ctx).toContain('### User Preferences')
      expect(ctx).toContain('Only wants remote roles')
      expect(ctx).toContain('Minimum salary $150k')
    })

    it('includes relevant context from search', () => {
      mockSearch.mockReturnValue([
        {
          fact: makeFact({ id: 'fact-3', category: 'company', content: 'Stripe has great culture' }),
          score: 1.0
        }
      ])

      const ctx = builder.buildChatContext('tell me about Stripe')
      expect(ctx).toContain('### Relevant Context')
      expect(ctx).toContain('Stripe has great culture')
    })

    it('deduplicates facts between preferences and search results', () => {
      const prefFact = makeFact({ id: 'same-id', content: 'Prefers remote' })
      mockGetByCategory.mockReturnValue([prefFact])
      mockSearch.mockReturnValue([{ fact: prefFact, score: 1.0 }])

      const ctx = builder.buildChatContext('remote jobs?')
      // Should have preferences section but NOT duplicate in relevant context
      expect(ctx).toContain('### User Preferences')
      expect(ctx).not.toContain('### Relevant Context')
    })

    it('shows both sections when search finds different facts', () => {
      mockGetByCategory.mockReturnValue([makeFact({ id: 'pref-1', content: 'Wants remote' })])
      mockSearch.mockReturnValue([
        {
          fact: makeFact({ id: 'comp-1', category: 'company', content: 'Google pays well' }),
          score: 0.9
        }
      ])

      const ctx = builder.buildChatContext('how about Google?')
      expect(ctx).toContain('### User Preferences')
      expect(ctx).toContain('### Relevant Context')
      expect(ctx).toContain('Wants remote')
      expect(ctx).toContain('Google pays well')
    })
  })
})
