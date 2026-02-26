import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: '',
  MIGRATION_V2_SQL: '',
  MIGRATION_V3_SQL: ''
}))

const { MemoryRepo } = await import('../memory-repo')

beforeEach(() => {
  testDb = createTestDatabase()
})

describe('MemoryRepo', () => {
  let repo: InstanceType<typeof MemoryRepo>

  beforeEach(() => {
    repo = new MemoryRepo()
  })

  describe('addFact()', () => {
    it('inserts a fact and returns it', () => {
      const fact = repo.addFact('preference', 'Prefers remote work')
      expect(fact.id).toBeTruthy()
      expect(fact.category).toBe('preference')
      expect(fact.content).toBe('Prefers remote work')
      expect(fact.source).toBe('user')
      expect(fact.confidence).toBe(1.0)
    })

    it('stores custom source and confidence', () => {
      const fact = repo.addFact('company', 'Acme has good culture', 'inferred', 0.8)
      expect(fact.source).toBe('inferred')
      expect(fact.confidence).toBe(0.8)
    })

    it('stores metadata as JSON', () => {
      const fact = repo.addFact('pattern', 'User rejects DevOps roles', 'system', 0.9, {
        rejectedCount: 5
      })
      expect(fact.metadata).toEqual({ rejectedCount: 5 })
    })
  })

  describe('getById()', () => {
    it('retrieves a fact by ID', () => {
      const created = repo.addFact('preference', 'Likes TypeScript')
      const retrieved = repo.getById(created.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved!.content).toBe('Likes TypeScript')
    })

    it('returns null for non-existent ID', () => {
      expect(repo.getById('nonexistent')).toBeNull()
    })

    it('increments access count on read', () => {
      const created = repo.addFact('preference', 'Test')
      repo.getById(created.id)
      repo.getById(created.id)

      // Direct query to check access_count (getById itself increments)
      const row = testDb
        .prepare('SELECT access_count FROM memory_facts WHERE id = ?')
        .get(created.id) as {
        access_count: number
      }
      // addFact calls getById once (to return), then we call twice more = 3
      expect(row.access_count).toBe(3)
    })
  })

  describe('updateFact()', () => {
    it('updates content', () => {
      const fact = repo.addFact('preference', 'Old content')
      repo.updateFact(fact.id, { content: 'New content' })

      const updated = repo.getById(fact.id)
      expect(updated!.content).toBe('New content')
    })

    it('updates confidence', () => {
      const fact = repo.addFact('preference', 'Test', 'user', 0.5)
      repo.updateFact(fact.id, { confidence: 0.9 })

      const updated = repo.getById(fact.id)
      expect(updated!.confidence).toBe(0.9)
    })

    it('updates metadata', () => {
      const fact = repo.addFact('company', 'Acme info')
      repo.updateFact(fact.id, { metadata: { rating: 4.5 } })

      const updated = repo.getById(fact.id)
      expect(updated!.metadata).toEqual({ rating: 4.5 })
    })

    it('does nothing with empty updates', () => {
      const fact = repo.addFact('preference', 'Unchanged')
      repo.updateFact(fact.id, {})

      const retrieved = repo.getById(fact.id)
      expect(retrieved!.content).toBe('Unchanged')
    })
  })

  describe('deleteFact()', () => {
    it('removes a fact', () => {
      const fact = repo.addFact('preference', 'To be deleted')
      repo.deleteFact(fact.id)

      expect(repo.getById(fact.id)).toBeNull()
    })
  })

  describe('getByCategory()', () => {
    it('returns facts filtered by category', () => {
      repo.addFact('preference', 'Pref 1')
      repo.addFact('preference', 'Pref 2')
      repo.addFact('company', 'Company info')

      const prefs = repo.getByCategory('preference')
      expect(prefs).toHaveLength(2)
      expect(prefs.every((f) => f.category === 'preference')).toBe(true)
    })

    it('respects limit', () => {
      repo.addFact('preference', 'A')
      repo.addFact('preference', 'B')
      repo.addFact('preference', 'C')

      const prefs = repo.getByCategory('preference', 2)
      expect(prefs).toHaveLength(2)
    })
  })

  describe('getRecentFacts()', () => {
    it('returns facts ordered by access time', () => {
      repo.addFact('preference', 'First')
      repo.addFact('company', 'Second')
      repo.addFact('pattern', 'Third')

      const recent = repo.getRecentFacts(10)
      expect(recent).toHaveLength(3)
    })

    it('filters by category', () => {
      repo.addFact('preference', 'Pref')
      repo.addFact('company', 'Company')

      const recent = repo.getRecentFacts(10, 'preference')
      expect(recent).toHaveLength(1)
      expect(recent[0].category).toBe('preference')
    })
  })

  describe('listAll()', () => {
    it('returns all facts', () => {
      repo.addFact('preference', 'A')
      repo.addFact('company', 'B')
      repo.addFact('pattern', 'C')

      const all = repo.listAll()
      expect(all).toHaveLength(3)
    })
  })

  describe('search()', () => {
    it('finds facts by FTS keyword match', () => {
      repo.addFact('preference', 'Prefers remote work with flexible hours')
      repo.addFact('preference', 'Wants high salary above 200k')
      repo.addFact('company', 'Acme Corp has remote-first culture')

      const results = repo.search('remote')
      expect(results.length).toBeGreaterThanOrEqual(1)
      expect(results.some((r) => r.fact.content.includes('remote'))).toBe(true)
    })

    it('filters search by category', () => {
      repo.addFact('preference', 'Remote preference')
      repo.addFact('company', 'Remote company culture')

      const results = repo.search('remote', { category: 'preference' })
      expect(results.every((r) => r.fact.category === 'preference')).toBe(true)
    })

    it('returns empty for no matches', () => {
      repo.addFact('preference', 'Likes TypeScript')

      const results = repo.search('python')
      expect(results).toHaveLength(0)
    })

    it('returns empty for empty query', () => {
      repo.addFact('preference', 'Something')

      const results = repo.search('')
      expect(results).toHaveLength(0)
    })

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) {
        repo.addFact('preference', `Remote job preference number ${i}`)
      }

      const results = repo.search('remote', { limit: 2 })
      expect(results).toHaveLength(2)
    })

    it('includes score in results', () => {
      repo.addFact('preference', 'Strongly prefers remote work')

      const results = repo.search('remote')
      expect(results[0]).toHaveProperty('score')
      expect(typeof results[0].score).toBe('number')
    })
  })

  describe('FTS5 triggers', () => {
    it('updates FTS index on content update', () => {
      const fact = repo.addFact('preference', 'Likes Python')
      repo.updateFact(fact.id, { content: 'Likes TypeScript' })

      const oldResults = repo.search('Python')
      expect(oldResults).toHaveLength(0)

      const newResults = repo.search('TypeScript')
      expect(newResults).toHaveLength(1)
    })

    it('removes from FTS index on delete', () => {
      const fact = repo.addFact('preference', 'Unique searchable content xyz123')
      repo.deleteFact(fact.id)

      const results = repo.search('xyz123')
      expect(results).toHaveLength(0)
    })
  })
})
