import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: ''
}))

const { UserProfileRepo } = await import('../user-profile-repo')

beforeEach(() => {
  testDb = createTestDatabase()
})

const sampleProfile = {
  name: 'John Doe',
  title: 'Senior React Developer',
  location: 'San Francisco, CA',
  summary: 'Experienced developer',
  skills: ['React', 'TypeScript', 'Node.js'],
  experience: [
    {
      role: 'Senior Developer',
      company: 'TechCo',
      duration: '3 years',
      description: 'Built things'
    }
  ],
  education: [
    {
      degree: 'BS Computer Science',
      school: 'MIT',
      year: '2015'
    }
  ],
  preferences: {
    targetRoles: ['Senior Frontend Engineer', 'Staff Engineer'],
    targetCompensation: { min: 150000, max: 200000, type: 'annual' as const },
    workTypes: ['full-time', 'contract'],
    remotePreference: 'remote' as const,
    dealbreakers: ['no remote', 'on-call'],
    priorities: ['compensation', 'work-life balance']
  },
  resumes: [
    {
      name: 'Main Resume',
      file: 'resume.pdf',
      targetRoles: ['Senior Frontend Engineer']
    }
  ]
}

describe('UserProfileRepo', () => {
  let repo: InstanceType<typeof UserProfileRepo>

  beforeEach(() => {
    repo = new UserProfileRepo()
  })

  describe('get()', () => {
    it('returns null when no profile exists', () => {
      expect(repo.get()).toBeNull()
    })

    it('returns null when profile has no name', () => {
      // Manually insert a profile without name
      testDb
        .prepare('INSERT INTO user_profile (id, data) VALUES (1, ?)')
        .run(JSON.stringify({ title: 'Developer' }))
      expect(repo.get()).toBeNull()
    })
  })

  describe('save()', () => {
    it('creates profile on first save', () => {
      repo.save(sampleProfile)
      const profile = repo.get()

      expect(profile).not.toBeNull()
      expect(profile!.name).toBe('John Doe')
      expect(profile!.skills).toEqual(['React', 'TypeScript', 'Node.js'])
    })

    it('updates profile on second save (upsert)', () => {
      repo.save(sampleProfile)
      repo.save({ ...sampleProfile, name: 'Jane Doe' })

      const profile = repo.get()
      expect(profile!.name).toBe('Jane Doe')
    })

    it('round-trips complex nested data', () => {
      repo.save(sampleProfile)
      const profile = repo.get()!

      expect(profile.experience).toHaveLength(1)
      expect(profile.experience[0].company).toBe('TechCo')
      expect(profile.preferences.targetCompensation.min).toBe(150000)
      expect(profile.preferences.dealbreakers).toEqual(['no remote', 'on-call'])
      expect(profile.resumes[0].targetRoles).toEqual(['Senior Frontend Engineer'])
    })
  })
})
