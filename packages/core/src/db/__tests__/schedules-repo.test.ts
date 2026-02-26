import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: '',
  MIGRATION_V2_SQL: '',
  MIGRATION_V3_SQL: '',
  MIGRATION_V4_SQL: ''
}))

const { SchedulesRepo } = await import('../schedules-repo')

beforeEach(() => {
  testDb = createTestDatabase()
})

describe('SchedulesRepo', () => {
  let repo: InstanceType<typeof SchedulesRepo>

  beforeEach(() => {
    repo = new SchedulesRepo()
  })

  describe('create()', () => {
    it('creates a schedule and returns it', () => {
      const schedule = repo.create({
        name: 'Morning extraction',
        taskType: 'extraction',
        cronExpression: '0 8 * * 1-5'
      })

      expect(schedule.id).toBeTruthy()
      expect(schedule.name).toBe('Morning extraction')
      expect(schedule.taskType).toBe('extraction')
      expect(schedule.cronExpression).toBe('0 8 * * 1-5')
      expect(schedule.enabled).toBe(true)
      expect(schedule.config).toEqual({})
    })

    it('creates a disabled schedule', () => {
      const schedule = repo.create({
        name: 'Backup',
        taskType: 'db_backup',
        cronExpression: '0 0 * * *',
        enabled: false
      })

      expect(schedule.enabled).toBe(false)
    })

    it('stores config as JSON', () => {
      const schedule = repo.create({
        name: 'Custom extraction',
        taskType: 'extraction',
        cronExpression: '0 9 * * *',
        config: { profileId: 'abc-123', maxPages: 5 }
      })

      expect(schedule.config).toEqual({ profileId: 'abc-123', maxPages: 5 })
    })
  })

  describe('getById()', () => {
    it('retrieves a schedule by ID', () => {
      const created = repo.create({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })

      const retrieved = repo.getById(created.id)
      expect(retrieved).not.toBeNull()
      expect(retrieved!.name).toBe('Test')
    })

    it('returns null for non-existent ID', () => {
      expect(repo.getById('nonexistent')).toBeNull()
    })
  })

  describe('list()', () => {
    it('returns all schedules', () => {
      repo.create({ name: 'A', taskType: 'extraction', cronExpression: '0 8 * * *' })
      repo.create({ name: 'B', taskType: 'db_backup', cronExpression: '0 0 * * *' })
      repo.create({
        name: 'C',
        taskType: 'log_rotation',
        cronExpression: '0 1 * * *',
        enabled: false
      })

      const all = repo.list()
      expect(all).toHaveLength(3)
    })
  })

  describe('listEnabled()', () => {
    it('returns only enabled schedules', () => {
      repo.create({ name: 'Enabled', taskType: 'extraction', cronExpression: '0 8 * * *' })
      repo.create({
        name: 'Disabled',
        taskType: 'db_backup',
        cronExpression: '0 0 * * *',
        enabled: false
      })

      const enabled = repo.listEnabled()
      expect(enabled).toHaveLength(1)
      expect(enabled[0].name).toBe('Enabled')
    })
  })

  describe('update()', () => {
    it('updates name', () => {
      const schedule = repo.create({
        name: 'Old',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })
      repo.update(schedule.id, { name: 'New Name' })

      const updated = repo.getById(schedule.id)
      expect(updated!.name).toBe('New Name')
    })

    it('updates cron expression', () => {
      const schedule = repo.create({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })
      repo.update(schedule.id, { cronExpression: '0 9 * * 1-5' })

      const updated = repo.getById(schedule.id)
      expect(updated!.cronExpression).toBe('0 9 * * 1-5')
    })

    it('updates enabled flag', () => {
      const schedule = repo.create({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })
      repo.update(schedule.id, { enabled: false })

      const updated = repo.getById(schedule.id)
      expect(updated!.enabled).toBe(false)
    })

    it('updates config', () => {
      const schedule = repo.create({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })
      repo.update(schedule.id, { config: { maxPages: 10 } })

      const updated = repo.getById(schedule.id)
      expect(updated!.config).toEqual({ maxPages: 10 })
    })

    it('does nothing with empty updates', () => {
      const schedule = repo.create({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })
      repo.update(schedule.id, {})

      const retrieved = repo.getById(schedule.id)
      expect(retrieved!.name).toBe('Test')
    })
  })

  describe('delete()', () => {
    it('removes a schedule', () => {
      const schedule = repo.create({
        name: 'ToDelete',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })
      repo.delete(schedule.id)

      expect(repo.getById(schedule.id)).toBeNull()
    })
  })

  describe('toggle()', () => {
    it('toggles enabled to false', () => {
      const schedule = repo.create({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })
      repo.toggle(schedule.id, false)

      const updated = repo.getById(schedule.id)
      expect(updated!.enabled).toBe(false)
    })

    it('toggles enabled to true', () => {
      const schedule = repo.create({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * *',
        enabled: false
      })
      repo.toggle(schedule.id, true)

      const updated = repo.getById(schedule.id)
      expect(updated!.enabled).toBe(true)
    })
  })

  describe('updateRunStatus()', () => {
    it('records success status', () => {
      const schedule = repo.create({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })
      repo.updateRunStatus(schedule.id, { lastRunStatus: 'success' })

      const updated = repo.getById(schedule.id)
      expect(updated!.lastRunStatus).toBe('success')
      expect(updated!.lastRunAt).toBeTruthy()
      expect(updated!.lastRunError).toBeNull()
    })

    it('records error status with message', () => {
      const schedule = repo.create({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })
      repo.updateRunStatus(schedule.id, {
        lastRunStatus: 'error',
        lastRunError: 'Connection timeout'
      })

      const updated = repo.getById(schedule.id)
      expect(updated!.lastRunStatus).toBe('error')
      expect(updated!.lastRunError).toBe('Connection timeout')
    })

    it('records next run time', () => {
      const schedule = repo.create({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * *'
      })
      repo.updateRunStatus(schedule.id, {
        lastRunStatus: 'success',
        nextRunAt: '2026-01-02T08:00:00'
      })

      const updated = repo.getById(schedule.id)
      expect(updated!.nextRunAt).toBe('2026-01-02T08:00:00')
    })
  })
})
