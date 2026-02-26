import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: ''
}))

const { SettingsRepo } = await import('../settings-repo')

beforeEach(() => {
  testDb = createTestDatabase()
})

describe('SettingsRepo', () => {
  let repo: InstanceType<typeof SettingsRepo>

  beforeEach(() => {
    repo = new SettingsRepo()
  })

  describe('get() / set()', () => {
    it('stores and retrieves a value', () => {
      repo.set('theme', 'dark')
      expect(repo.get('theme')).toBe('dark')
    })

    it('returns null for missing key', () => {
      expect(repo.get('nonexistent')).toBeNull()
    })

    it('upserts on duplicate key', () => {
      repo.set('theme', 'dark')
      repo.set('theme', 'light')
      expect(repo.get('theme')).toBe('light')
    })
  })

  describe('getAutonomy()', () => {
    it('returns defaults when no autonomy setting exists', () => {
      const autonomy = repo.getAutonomy()
      expect(autonomy.level).toBe(2)
      expect(autonomy.autoApplyThreshold).toBe(90)
      expect(autonomy.pauseOn.customQuestions).toBe(true)
    })

    it('merges stored values with defaults', () => {
      repo.set('autonomy', JSON.stringify({ level: 3, autoApplyThreshold: 80 }))
      const autonomy = repo.getAutonomy()

      expect(autonomy.level).toBe(3)
      expect(autonomy.autoApplyThreshold).toBe(80)
      // Default values still present
      expect(autonomy.reviewThreshold).toBe(70)
      expect(autonomy.pauseOn.customQuestions).toBe(true)
    })
  })

  describe('setAutonomy()', () => {
    it('stores and retrieves autonomy settings', () => {
      const settings = {
        level: 3 as const,
        autoApplyThreshold: 80,
        reviewThreshold: 60,
        skipThreshold: 30,
        pauseOn: {
          customQuestions: false,
          externalApply: true,
          salaryQuestions: true,
          captcha: true,
          lowConfidenceAnswer: false,
          newSiteDetected: true
        },
        dailyApplicationCap: 30,
        sessionApplicationCap: 20,
        sessionDurationMinutes: 60,
        actionsPerMinute: 10
      }
      repo.setAutonomy(settings)
      const retrieved = repo.getAutonomy()

      expect(retrieved.level).toBe(3)
      expect(retrieved.autoApplyThreshold).toBe(80)
      expect(retrieved.pauseOn.customQuestions).toBe(false)
    })
  })

  describe('getApiKey() / setApiKey()', () => {
    it('stores and retrieves API key', () => {
      repo.setApiKey('sk-ant-test-key')
      expect(repo.getApiKey()).toBe('sk-ant-test-key')
    })

    it('returns null when no API key set', () => {
      expect(repo.getApiKey()).toBeNull()
    })
  })
})
