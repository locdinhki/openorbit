import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MemoryRepo } from '../../db/memory-repo'

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../db/memory-repo', () => ({
  MemoryRepo: class {}
}))

const { extractAndSaveMemories } = await import('../memory-extractor')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createMockRepo() {
  let factId = 0
  return {
    addFact: vi.fn((category: string, content: string, source: string, confidence: number) => ({
      id: `fact-${++factId}`,
      category,
      content,
      source,
      confidence,
      metadata: {},
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      accessedAt: '2025-01-01',
      accessCount: 0
    })),
    getByCategory: vi.fn().mockReturnValue([]),
    search: vi.fn().mockReturnValue([]),
    listAll: vi.fn().mockReturnValue([]),
    getById: vi.fn(),
    updateFact: vi.fn(),
    deleteFact: vi.fn(),
    getRecentFacts: vi.fn().mockReturnValue([])
  }
}

describe('extractAndSaveMemories', () => {
  let repo: ReturnType<typeof createMockRepo>

  beforeEach(() => {
    repo = createMockRepo()
  })

  it('extracts a single memory tag', () => {
    const response = 'Got it. <memory category="preference">Only wants remote roles</memory>'
    const result = extractAndSaveMemories(response, repo as unknown as MemoryRepo)

    expect(result.cleanedResponse).toBe('Got it.')
    expect(result.savedFacts).toHaveLength(1)
    expect(result.savedFacts[0].category).toBe('preference')
    expect(result.savedFacts[0].content).toBe('Only wants remote roles')
    expect(repo.addFact).toHaveBeenCalledWith('preference', 'Only wants remote roles', 'chat', 0.8)
  })

  it('extracts multiple memory tags', () => {
    const response =
      'Noted! <memory category="preference">Minimum salary $150k</memory> ' +
      'I\'ll keep that in mind. <memory category="company">Stripe uses Ruby on Rails</memory>'
    const result = extractAndSaveMemories(response, repo as unknown as MemoryRepo)

    expect(result.savedFacts).toHaveLength(2)
    expect(result.savedFacts[0].content).toBe('Minimum salary $150k')
    expect(result.savedFacts[1].content).toBe('Stripe uses Ruby on Rails')
    expect(result.cleanedResponse).not.toContain('<memory')
  })

  it('strips tags with invalid category but does not save', () => {
    const response = 'OK. <memory category="invalid">some fact</memory> Done.'
    const result = extractAndSaveMemories(response, repo as unknown as MemoryRepo)

    expect(result.savedFacts).toHaveLength(0)
    expect(repo.addFact).not.toHaveBeenCalled()
    expect(result.cleanedResponse).toBe('OK. Done.')
  })

  it('strips tags with empty content', () => {
    const response = 'OK. <memory category="preference">  </memory> Done.'
    const result = extractAndSaveMemories(response, repo as unknown as MemoryRepo)

    expect(result.savedFacts).toHaveLength(0)
    expect(repo.addFact).not.toHaveBeenCalled()
    expect(result.cleanedResponse).toBe('OK. Done.')
  })

  it('returns response unchanged when no tags present', () => {
    const response = 'Here are your new jobs today.'
    const result = extractAndSaveMemories(response, repo as unknown as MemoryRepo)

    expect(result.cleanedResponse).toBe('Here are your new jobs today.')
    expect(result.savedFacts).toHaveLength(0)
  })

  it('handles multiline content in tags', () => {
    const response =
      'Got it. <memory category="answer">I have 8 years of React experience\nand led a team of 5</memory>'
    const result = extractAndSaveMemories(response, repo as unknown as MemoryRepo)

    expect(result.savedFacts).toHaveLength(1)
    expect(result.savedFacts[0].content).toBe(
      'I have 8 years of React experience\nand led a team of 5'
    )
  })

  it('handles all valid categories', () => {
    const response = [
      '<memory category="preference">pref</memory>',
      '<memory category="company">comp</memory>',
      '<memory category="pattern">pat</memory>',
      '<memory category="answer">ans</memory>'
    ].join(' ')
    const result = extractAndSaveMemories(response, repo as unknown as MemoryRepo)

    expect(result.savedFacts).toHaveLength(4)
    expect(result.savedFacts.map((f) => f.category)).toEqual([
      'preference',
      'company',
      'pattern',
      'answer'
    ])
  })

  it('continues extraction if addFact throws', () => {
    repo.addFact
      .mockImplementationOnce(() => {
        throw new Error('DB error')
      })
      .mockImplementation((cat: string, content: string) => ({
        id: 'fact-2',
        category: cat,
        content,
        source: 'chat',
        confidence: 0.8,
        metadata: {},
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
        accessedAt: '2025-01-01',
        accessCount: 0
      }))

    const response =
      '<memory category="preference">first</memory> <memory category="preference">second</memory>'
    const result = extractAndSaveMemories(response, repo as unknown as MemoryRepo)

    expect(repo.addFact).toHaveBeenCalledTimes(2)
    expect(result.savedFacts).toHaveLength(1)
    expect(result.savedFacts[0].content).toBe('second')
  })
})
