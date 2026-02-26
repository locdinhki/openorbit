import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: ''
}))

const { AnswersRepo } = await import('../answers-repo')

beforeEach(() => {
  testDb = createTestDatabase()
})

describe('AnswersRepo', () => {
  let repo: InstanceType<typeof AnswersRepo>

  beforeEach(() => {
    repo = new AnswersRepo()
  })

  describe('insert()', () => {
    it('creates a template with ID and timestamps', () => {
      const template = repo.insert({
        questionPattern: 'years of experience',
        answer: '10 years',
        platform: 'linkedin'
      })

      expect(template.id).toBeDefined()
      expect(template.questionPattern).toBe('years of experience')
      expect(template.answer).toBe('10 years')
      expect(template.platform).toBe('linkedin')
      expect(template.usageCount).toBe(0)
      expect(template.createdAt).toBeDefined()
    })
  })

  describe('getById()', () => {
    it('returns null for nonexistent', () => {
      expect(repo.getById('nonexistent')).toBeNull()
    })

    it('returns correct template', () => {
      const created = repo.insert({ questionPattern: 'test', answer: 'yes' })
      const found = repo.getById(created.id)

      expect(found).not.toBeNull()
      expect(found!.questionPattern).toBe('test')
    })
  })

  describe('list()', () => {
    it('returns all templates without platform filter', () => {
      repo.insert({ questionPattern: 'q1', answer: 'a1', platform: 'linkedin' })
      repo.insert({ questionPattern: 'q2', answer: 'a2', platform: 'indeed' })
      repo.insert({ questionPattern: 'q3', answer: 'a3' })

      const all = repo.list()
      expect(all).toHaveLength(3)
    })

    it('returns platform-specific and global templates', () => {
      repo.insert({ questionPattern: 'q1', answer: 'a1', platform: 'linkedin' })
      repo.insert({ questionPattern: 'q2', answer: 'a2', platform: 'indeed' })
      repo.insert({ questionPattern: 'q3', answer: 'a3' }) // global (no platform)

      const linkedin = repo.list('linkedin')
      expect(linkedin).toHaveLength(2) // linkedin + global
      expect(linkedin.some((t) => t.platform === 'linkedin')).toBe(true)
      expect(linkedin.some((t) => t.platform === undefined)).toBe(true)
    })
  })

  describe('findMatch()', () => {
    it('finds matching template by substring', () => {
      repo.insert({ questionPattern: 'years of experience', answer: '10' })
      repo.insert({ questionPattern: 'salary expectation', answer: '$150k' })

      const match = repo.findMatch('How many years of experience do you have?')
      expect(match).not.toBeNull()
      expect(match!.answer).toBe('10')
    })

    it('returns null when no match', () => {
      repo.insert({ questionPattern: 'years of experience', answer: '10' })

      const match = repo.findMatch('What is your favorite color?')
      expect(match).toBeNull()
    })

    it('is case-insensitive', () => {
      repo.insert({ questionPattern: 'YEARS OF EXPERIENCE', answer: '10' })

      const match = repo.findMatch('how many years of experience?')
      expect(match).not.toBeNull()
    })
  })

  describe('update()', () => {
    it('updates specific fields', () => {
      const template = repo.insert({ questionPattern: 'old', answer: 'old answer' })
      repo.update(template.id, { answer: 'new answer' })

      const updated = repo.getById(template.id)!
      expect(updated.answer).toBe('new answer')
      expect(updated.questionPattern).toBe('old') // unchanged
    })
  })

  describe('recordUsage()', () => {
    it('increments usage_count and sets last_used_at', () => {
      const template = repo.insert({ questionPattern: 'test', answer: 'yes' })
      expect(template.usageCount).toBe(0)
      expect(template.lastUsedAt).toBeUndefined()

      repo.recordUsage(template.id)
      const after1 = repo.getById(template.id)!
      expect(after1.usageCount).toBe(1)
      expect(after1.lastUsedAt).toBeDefined()

      repo.recordUsage(template.id)
      const after2 = repo.getById(template.id)!
      expect(after2.usageCount).toBe(2)
    })
  })

  describe('delete()', () => {
    it('removes the template', () => {
      const template = repo.insert({ questionPattern: 'test', answer: 'yes' })
      repo.delete(template.id)
      expect(repo.getById(template.id)).toBeNull()
    })
  })
})
