import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: ''
}))

const { ProfilesRepo } = await import('../profiles-repo')

beforeEach(() => {
  testDb = createTestDatabase()
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    name: 'React Jobs',
    enabled: true,
    platform: 'linkedin' as const,
    search: {
      keywords: ['react', 'typescript'],
      location: ['Remote'],
      datePosted: 'pastWeek' as const,
      experienceLevel: ['senior'],
      jobType: ['full-time' as const],
      excludeTerms: ['java']
    },
    application: {
      resumeFile: 'resume.pdf',
      defaultAnswers: { 'years of experience': '10' }
    },
    ...overrides
  }
}

describe('ProfilesRepo', () => {
  let repo: InstanceType<typeof ProfilesRepo>

  beforeEach(() => {
    repo = new ProfilesRepo()
  })

  describe('CRUD lifecycle', () => {
    it('insert → getById → update → delete', () => {
      // Insert
      const created = repo.insert(makeProfile())
      expect(created.id).toBeDefined()
      expect(created.name).toBe('React Jobs')
      expect(created.enabled).toBe(true)

      // GetById
      const found = repo.getById(created.id)
      expect(found).not.toBeNull()
      expect(found!.name).toBe('React Jobs')

      // Update
      repo.update(created.id, { name: 'Updated Name' })
      const updated = repo.getById(created.id)
      expect(updated!.name).toBe('Updated Name')

      // Delete
      repo.delete(created.id)
      expect(repo.getById(created.id)).toBeNull()
    })
  })

  describe('list()', () => {
    it('returns all profiles', () => {
      repo.insert(makeProfile({ name: 'Profile 1' }))
      repo.insert(makeProfile({ name: 'Profile 2' }))

      const profiles = repo.list()
      expect(profiles).toHaveLength(2)
    })
  })

  describe('listEnabled()', () => {
    it('returns only enabled profiles', () => {
      repo.insert(makeProfile({ name: 'Enabled', enabled: true }))
      repo.insert(makeProfile({ name: 'Disabled', enabled: false }))

      const enabled = repo.listEnabled()
      expect(enabled).toHaveLength(1)
      expect(enabled[0].name).toBe('Enabled')
    })
  })

  describe('toggleEnabled()', () => {
    it('flips enabled state', () => {
      const profile = repo.insert(makeProfile({ enabled: true }))
      expect(repo.getById(profile.id)!.enabled).toBe(true)

      repo.toggleEnabled(profile.id, false)
      expect(repo.getById(profile.id)!.enabled).toBe(false)

      repo.toggleEnabled(profile.id, true)
      expect(repo.getById(profile.id)!.enabled).toBe(true)
    })
  })

  describe('JSON round-trip', () => {
    it('correctly serializes and deserializes search config', () => {
      const input = makeProfile()
      const created = repo.insert(input)
      const found = repo.getById(created.id)!

      expect(found.search.keywords).toEqual(['react', 'typescript'])
      expect(found.search.location).toEqual(['Remote'])
      expect(found.search.excludeTerms).toEqual(['java'])
    })

    it('correctly serializes and deserializes application config', () => {
      const input = makeProfile()
      const created = repo.insert(input)
      const found = repo.getById(created.id)!

      expect(found.application.resumeFile).toBe('resume.pdf')
      expect(found.application.defaultAnswers).toEqual({ 'years of experience': '10' })
    })
  })

  describe('update() with partial fields', () => {
    it('updates only name', () => {
      const profile = repo.insert(makeProfile())
      repo.update(profile.id, { name: 'New Name' })

      const updated = repo.getById(profile.id)!
      expect(updated.name).toBe('New Name')
      expect(updated.enabled).toBe(true) // unchanged
    })

    it('updates only enabled', () => {
      const profile = repo.insert(makeProfile({ enabled: true }))
      repo.update(profile.id, { enabled: false })

      const updated = repo.getById(profile.id)!
      expect(updated.enabled).toBe(false)
      expect(updated.name).toBe('React Jobs') // unchanged
    })

    it('updates search config', () => {
      const profile = repo.insert(makeProfile())
      repo.update(profile.id, {
        search: {
          keywords: ['vue'],
          location: ['NYC'],
          datePosted: 'pastMonth' as const,
          experienceLevel: [],
          jobType: ['contract' as const],
          excludeTerms: []
        }
      })

      const updated = repo.getById(profile.id)!
      expect(updated.search.keywords).toEqual(['vue'])
    })
  })
})
