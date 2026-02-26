import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSchedule = vi.fn()
const mockValidate = vi.fn().mockReturnValue(true)

vi.mock('node-cron', () => ({
  default: {
    schedule: mockSchedule,
    validate: mockValidate
  }
}))

const mockListEnabled = vi.fn().mockReturnValue([])
const mockGetById = vi.fn().mockReturnValue(null)
const mockUpdateRunStatus = vi.fn()
const mockList = vi.fn().mockReturnValue([])
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockToggle = vi.fn()

vi.mock('../../db/schedules-repo', () => ({
  SchedulesRepo: class {
    listEnabled = mockListEnabled
    getById = mockGetById
    updateRunStatus = mockUpdateRunStatus
    list = mockList
    create = mockCreate
    update = mockUpdate
    delete = mockDelete
    toggle = mockToggle
  }
}))

const mockInsertStart = vi.fn().mockReturnValue('run-1')
const mockComplete = vi.fn()
const mockListBySchedule = vi.fn().mockReturnValue([])

vi.mock('../../db/schedule-runs-repo', () => ({
  ScheduleRunsRepo: class {
    insertStart = mockInsertStart
    complete = mockComplete
    listBySchedule = mockListBySchedule
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

const { Scheduler } = await import('../scheduler')

const TEST_META = {
  label: 'Test Tool',
  description: 'A test tool',
  extensionId: 'ext-test',
  configSchema: []
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeSchedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sched-1',
    name: 'Test Schedule',
    taskType: 'extraction' as const,
    cronExpression: '0 8 * * 1-5',
    enabled: true,
    config: {},
    lastRunAt: null,
    lastRunStatus: null,
    lastRunError: null,
    nextRunAt: null,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
    ...overrides
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeMockCronJob() {
  return { stop: vi.fn() }
}

describe('Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSchedule.mockReturnValue(makeMockCronJob())
    mockValidate.mockReturnValue(true)
    mockListEnabled.mockReturnValue([])
    mockGetById.mockReturnValue(null)
    mockInsertStart.mockReturnValue('run-1')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('start()', () => {
    it('loads enabled schedules and registers cron jobs', () => {
      const schedule = makeSchedule()
      mockListEnabled.mockReturnValue([schedule])

      const scheduler = new Scheduler()
      scheduler.start()

      expect(mockListEnabled).toHaveBeenCalled()
      expect(mockSchedule).toHaveBeenCalledWith('0 8 * * 1-5', expect.any(Function))
      expect(scheduler.getTaskCount()).toBe(1)
    })

    it('starts only once (idempotent)', () => {
      const scheduler = new Scheduler()
      scheduler.start()
      scheduler.start()

      expect(mockListEnabled).toHaveBeenCalledTimes(1)
    })

    it('handles empty schedules', () => {
      mockListEnabled.mockReturnValue([])

      const scheduler = new Scheduler()
      scheduler.start()

      expect(scheduler.getTaskCount()).toBe(0)
    })
  })

  describe('stop()', () => {
    it('stops all cron jobs', () => {
      const cronJob = makeMockCronJob()
      mockSchedule.mockReturnValue(cronJob)
      mockListEnabled.mockReturnValue([makeSchedule()])

      const scheduler = new Scheduler()
      scheduler.start()
      scheduler.stop()

      expect(cronJob.stop).toHaveBeenCalled()
      expect(scheduler.getTaskCount()).toBe(0)
      expect(scheduler.isStarted()).toBe(false)
    })
  })

  describe('addCronJob()', () => {
    it('registers a new cron job', () => {
      const scheduler = new Scheduler()
      scheduler.addCronJob(makeSchedule())

      expect(mockSchedule).toHaveBeenCalledWith('0 8 * * 1-5', expect.any(Function))
      expect(scheduler.getTaskCount()).toBe(1)
    })

    it('replaces existing job for same schedule ID', () => {
      const cronJob1 = makeMockCronJob()
      const cronJob2 = makeMockCronJob()
      mockSchedule.mockReturnValueOnce(cronJob1).mockReturnValueOnce(cronJob2)

      const scheduler = new Scheduler()
      scheduler.addCronJob(makeSchedule())
      scheduler.addCronJob(makeSchedule())

      expect(cronJob1.stop).toHaveBeenCalled()
      expect(scheduler.getTaskCount()).toBe(1)
    })

    it('skips invalid cron expressions', () => {
      mockValidate.mockReturnValue(false)

      const scheduler = new Scheduler()
      scheduler.addCronJob(makeSchedule({ cronExpression: 'invalid' }))

      expect(mockSchedule).not.toHaveBeenCalled()
      expect(scheduler.getTaskCount()).toBe(0)
    })
  })

  describe('removeCronJob()', () => {
    it('stops and removes a cron job', () => {
      const cronJob = makeMockCronJob()
      mockSchedule.mockReturnValue(cronJob)

      const scheduler = new Scheduler()
      scheduler.addCronJob(makeSchedule())
      scheduler.removeCronJob('sched-1')

      expect(cronJob.stop).toHaveBeenCalled()
      expect(scheduler.getTaskCount()).toBe(0)
    })

    it('does nothing for non-existent ID', () => {
      const scheduler = new Scheduler()
      scheduler.removeCronJob('nonexistent')

      expect(scheduler.getTaskCount()).toBe(0)
    })
  })

  describe('registerTaskType()', () => {
    it('registers a handler with metadata', () => {
      const scheduler = new Scheduler()
      const handler = vi.fn().mockResolvedValue(undefined)
      scheduler.registerTaskType('extraction', handler, TEST_META)

      expect(scheduler.getTaskCount()).toBe(0) // no cron jobs yet
    })
  })

  describe('listTools()', () => {
    it('returns metadata for all registered tools', () => {
      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', vi.fn(), {
        label: 'Job Extraction',
        description: 'Extract jobs',
        extensionId: 'ext-jobs',
        configSchema: [{ key: 'profileIds', type: 'multiselect', label: 'Profiles' }]
      })
      scheduler.registerTaskType('backup', vi.fn(), {
        label: 'DB Backup',
        description: 'Backup database',
        extensionId: 'core',
        configSchema: []
      })

      const tools = scheduler.listTools()
      expect(tools).toHaveLength(2)
      expect(tools[0]).toEqual({
        taskType: 'extraction',
        label: 'Job Extraction',
        description: 'Extract jobs',
        extensionId: 'ext-jobs',
        configSchema: [{ key: 'profileIds', type: 'multiselect', label: 'Profiles' }]
      })
      expect(tools[1]).toEqual({
        taskType: 'backup',
        label: 'DB Backup',
        description: 'Backup database',
        extensionId: 'core',
        configSchema: []
      })
    })

    it('returns empty array when no tools registered', () => {
      const scheduler = new Scheduler()
      expect(scheduler.listTools()).toEqual([])
    })
  })

  describe('task execution', () => {
    it('executes registered handler with config', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      const schedule = makeSchedule({ config: { profileIds: ['p1', 'p2'] } })
      mockGetById.mockReturnValue(schedule)

      let cronCallback: () => void = () => {}
      mockSchedule.mockImplementation((_expr: string, cb: () => void) => {
        cronCallback = cb
        return makeMockCronJob()
      })

      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', handler, TEST_META)
      scheduler.addCronJob(schedule)

      cronCallback()

      await vi.waitFor(() => {
        expect(mockUpdateRunStatus).toHaveBeenCalledWith('sched-1', {
          lastRunStatus: 'success'
        })
      })

      expect(handler).toHaveBeenCalledWith({ profileIds: ['p1', 'p2'] })
    })

    it('passes empty config when schedule has no config', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      const schedule = makeSchedule({ config: undefined })
      mockGetById.mockReturnValue(schedule)

      let cronCallback: () => void = () => {}
      mockSchedule.mockImplementation((_expr: string, cb: () => void) => {
        cronCallback = cb
        return makeMockCronJob()
      })

      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', handler, TEST_META)
      scheduler.addCronJob(schedule)

      cronCallback()

      await vi.waitFor(() => {
        expect(handler).toHaveBeenCalledWith({})
      })
    })

    it('warns when no handler registered for task type', async () => {
      const schedule = makeSchedule({ taskType: 'unknown_type' })
      mockGetById.mockReturnValue(schedule)

      let cronCallback: () => void = () => {}
      mockSchedule.mockImplementation((_expr: string, cb: () => void) => {
        cronCallback = cb
        return makeMockCronJob()
      })

      const scheduler = new Scheduler()
      scheduler.addCronJob(schedule)

      cronCallback()

      // Should complete successfully (no-op) but with success status
      await vi.waitFor(() => {
        expect(mockUpdateRunStatus).toHaveBeenCalledWith('sched-1', {
          lastRunStatus: 'success'
        })
      })
    })

    it('records error status on task failure', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Network error'))

      const schedule = makeSchedule()
      mockGetById.mockReturnValue(schedule)

      let cronCallback: () => void = () => {}
      mockSchedule.mockImplementation((_expr: string, cb: () => void) => {
        cronCallback = cb
        return makeMockCronJob()
      })

      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', handler, TEST_META)
      scheduler.addCronJob(schedule)

      cronCallback()

      await vi.waitFor(() => {
        expect(mockUpdateRunStatus).toHaveBeenCalledWith('sched-1', {
          lastRunStatus: 'error',
          lastRunError: 'Network error'
        })
      })
    })

    it('skips execution when schedule is disabled', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      mockGetById.mockReturnValue(makeSchedule({ enabled: false }))

      let cronCallback: () => void = () => {}
      mockSchedule.mockImplementation((_expr: string, cb: () => void) => {
        cronCallback = cb
        return makeMockCronJob()
      })

      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', handler, TEST_META)
      scheduler.addCronJob(makeSchedule())

      cronCallback()

      await new Promise((r) => setTimeout(r, 50))

      expect(handler).not.toHaveBeenCalled()
      expect(mockUpdateRunStatus).not.toHaveBeenCalled()
    })

    it('skips execution when schedule is deleted', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      mockGetById.mockReturnValue(null)

      let cronCallback: () => void = () => {}
      mockSchedule.mockImplementation((_expr: string, cb: () => void) => {
        cronCallback = cb
        return makeMockCronJob()
      })

      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', handler, TEST_META)
      scheduler.addCronJob(makeSchedule())

      cronCallback()

      await new Promise((r) => setTimeout(r, 50))

      expect(handler).not.toHaveBeenCalled()
      expect(mockUpdateRunStatus).not.toHaveBeenCalled()
    })

    it('prevents overlapping execution', async () => {
      let resolveRun: () => void = () => {}
      const handler = vi.fn().mockReturnValue(
        new Promise<void>((resolve) => {
          resolveRun = resolve
        })
      )

      const schedule = makeSchedule()
      mockGetById.mockReturnValue(schedule)

      let cronCallback: () => void = () => {}
      mockSchedule.mockImplementation((_expr: string, cb: () => void) => {
        cronCallback = cb
        return makeMockCronJob()
      })

      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', handler, TEST_META)
      scheduler.addCronJob(schedule)

      // First trigger — starts executing
      cronCallback()
      await new Promise((r) => setTimeout(r, 10))
      expect(scheduler.isExecuting('sched-1')).toBe(true)

      // Second trigger — should be skipped (overlap)
      cronCallback()
      await new Promise((r) => setTimeout(r, 10))

      // Only one call to handler (from the first trigger)
      expect(handler).toHaveBeenCalledTimes(1)

      // Complete the first run
      resolveRun()
      await vi.waitFor(() => {
        expect(scheduler.isExecuting('sched-1')).toBe(false)
      })
    })

    it('records run in schedule_runs via runsRepo on cron execution', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      const schedule = makeSchedule()
      mockGetById.mockReturnValue(schedule)

      let cronCallback: () => void = () => {}
      mockSchedule.mockImplementation((_expr: string, cb: () => void) => {
        cronCallback = cb
        return makeMockCronJob()
      })

      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', handler, TEST_META)
      scheduler.addCronJob(schedule)

      cronCallback()

      await vi.waitFor(() => {
        expect(mockInsertStart).toHaveBeenCalledWith('sched-1')
        expect(mockComplete).toHaveBeenCalledWith('run-1', {
          status: 'success',
          durationMs: expect.any(Number)
        })
      })
    })

    it('records error run in schedule_runs on failure', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Boom'))
      const schedule = makeSchedule()
      mockGetById.mockReturnValue(schedule)

      let cronCallback: () => void = () => {}
      mockSchedule.mockImplementation((_expr: string, cb: () => void) => {
        cronCallback = cb
        return makeMockCronJob()
      })

      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', handler, TEST_META)
      scheduler.addCronJob(schedule)

      cronCallback()

      await vi.waitFor(() => {
        expect(mockInsertStart).toHaveBeenCalledWith('sched-1')
        expect(mockComplete).toHaveBeenCalledWith('run-1', {
          status: 'error',
          errorMessage: 'Boom',
          durationMs: expect.any(Number)
        })
      })
    })

    it('emits onRunStart and onRunComplete events on cron execution', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      const schedule = makeSchedule()
      mockGetById.mockReturnValue(schedule)

      const onRunStart = vi.fn()
      const onRunComplete = vi.fn()

      let cronCallback: () => void = () => {}
      mockSchedule.mockImplementation((_expr: string, cb: () => void) => {
        cronCallback = cb
        return makeMockCronJob()
      })

      const scheduler = new Scheduler({ onRunStart, onRunComplete })
      scheduler.registerTaskType('extraction', handler, TEST_META)
      scheduler.addCronJob(schedule)

      cronCallback()

      await vi.waitFor(() => {
        expect(onRunStart).toHaveBeenCalledWith('sched-1')
        expect(onRunComplete).toHaveBeenCalledWith('sched-1', {
          status: 'success',
          durationMs: expect.any(Number)
        })
      })
    })
  })

  describe('triggerNow()', () => {
    it('executes handler immediately', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      const schedule = makeSchedule()
      mockGetById.mockReturnValue(schedule)

      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', handler, TEST_META)

      await scheduler.triggerNow('sched-1')

      expect(handler).toHaveBeenCalledWith({})
      expect(mockInsertStart).toHaveBeenCalledWith('sched-1')
      expect(mockComplete).toHaveBeenCalledWith('run-1', {
        status: 'success',
        durationMs: expect.any(Number)
      })
    })

    it('throws when schedule not found', async () => {
      mockGetById.mockReturnValue(null)

      const scheduler = new Scheduler()

      await expect(scheduler.triggerNow('nonexistent')).rejects.toThrow(
        'Schedule not found: nonexistent'
      )
    })

    it('throws when already executing', async () => {
      let resolveRun: () => void = () => {}
      const handler = vi.fn().mockReturnValue(
        new Promise<void>((resolve) => {
          resolveRun = resolve
        })
      )
      const schedule = makeSchedule()
      mockGetById.mockReturnValue(schedule)

      const scheduler = new Scheduler()
      scheduler.registerTaskType('extraction', handler, TEST_META)

      // Start first trigger (don't await — it's still running)
      const firstRun = scheduler.triggerNow('sched-1')

      // Second trigger should throw
      await expect(scheduler.triggerNow('sched-1')).rejects.toThrow(
        'Schedule is already executing: sched-1'
      )

      // Clean up
      resolveRun()
      await firstRun
    })

    it('emits onRunStart and onRunComplete events', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      const schedule = makeSchedule()
      mockGetById.mockReturnValue(schedule)

      const onRunStart = vi.fn()
      const onRunComplete = vi.fn()

      const scheduler = new Scheduler({ onRunStart, onRunComplete })
      scheduler.registerTaskType('extraction', handler, TEST_META)

      await scheduler.triggerNow('sched-1')

      expect(onRunStart).toHaveBeenCalledWith('sched-1')
      expect(onRunComplete).toHaveBeenCalledWith('sched-1', {
        status: 'success',
        durationMs: expect.any(Number)
      })
    })

    it('tracks durationMs', async () => {
      const handler = vi
        .fn()
        .mockImplementation(() => new Promise<void>((resolve) => setTimeout(resolve, 20)))
      const schedule = makeSchedule()
      mockGetById.mockReturnValue(schedule)

      const onRunComplete = vi.fn()
      const scheduler = new Scheduler({ onRunComplete })
      scheduler.registerTaskType('extraction', handler, TEST_META)

      await scheduler.triggerNow('sched-1')

      expect(onRunComplete).toHaveBeenCalledTimes(1)
      const result = onRunComplete.mock.calls[0][1]
      expect(result.durationMs).toBeGreaterThanOrEqual(15)
    })

    it('records error and re-throws on handler failure', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Task failed'))
      const schedule = makeSchedule()
      mockGetById.mockReturnValue(schedule)

      const onRunComplete = vi.fn()
      const scheduler = new Scheduler({ onRunComplete })
      scheduler.registerTaskType('extraction', handler, TEST_META)

      await expect(scheduler.triggerNow('sched-1')).rejects.toThrow('Task failed')

      expect(mockComplete).toHaveBeenCalledWith('run-1', {
        status: 'error',
        errorMessage: 'Task failed',
        durationMs: expect.any(Number)
      })
      expect(onRunComplete).toHaveBeenCalledWith('sched-1', {
        status: 'error',
        error: 'Task failed',
        durationMs: expect.any(Number)
      })
    })
  })

  describe('listRuns()', () => {
    it('delegates to runsRepo', () => {
      const runs = [
        {
          id: 'r1',
          scheduleId: 'sched-1',
          status: 'success',
          errorMessage: null,
          durationMs: 100,
          startedAt: '2025-01-01',
          completedAt: '2025-01-01'
        }
      ]
      mockListBySchedule.mockReturnValue(runs)

      const scheduler = new Scheduler()
      expect(scheduler.listRuns('sched-1')).toEqual(runs)
      expect(mockListBySchedule).toHaveBeenCalledWith('sched-1', 20, 0)
    })

    it('passes custom limit and offset', () => {
      mockListBySchedule.mockReturnValue([])

      const scheduler = new Scheduler()
      scheduler.listRuns('sched-1', 10, 5)

      expect(mockListBySchedule).toHaveBeenCalledWith('sched-1', 10, 5)
    })
  })

  describe('CRUD methods', () => {
    it('createSchedule saves to DB and registers cron job when started', () => {
      const created = makeSchedule()
      mockCreate.mockReturnValue(created)

      const scheduler = new Scheduler()
      scheduler.start()
      const result = scheduler.createSchedule({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * 1-5'
      })

      expect(mockCreate).toHaveBeenCalledWith({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * 1-5'
      })
      expect(result).toEqual(created)
      expect(mockSchedule).toHaveBeenCalledWith('0 8 * * 1-5', expect.any(Function))
      expect(scheduler.getTaskCount()).toBe(1)
    })

    it('createSchedule does not register cron if disabled', () => {
      const created = makeSchedule({ enabled: false })
      mockCreate.mockReturnValue(created)

      const scheduler = new Scheduler()
      scheduler.start()
      scheduler.createSchedule({
        name: 'Test',
        taskType: 'extraction',
        cronExpression: '0 8 * * 1-5',
        enabled: false
      })

      expect(mockSchedule).not.toHaveBeenCalled()
    })

    it('updateSchedule re-registers cron job', () => {
      const updated = makeSchedule({ cronExpression: '0 9 * * *' })
      mockGetById.mockReturnValue(updated)

      const scheduler = new Scheduler()
      scheduler.start()
      // Add initial cron job
      scheduler.addCronJob(makeSchedule())
      expect(scheduler.getTaskCount()).toBe(1)

      const result = scheduler.updateSchedule('sched-1', { cronExpression: '0 9 * * *' })

      expect(mockUpdate).toHaveBeenCalledWith('sched-1', { cronExpression: '0 9 * * *' })
      expect(result).toEqual(updated)
      // Cron was re-registered (removed + added)
      expect(scheduler.getTaskCount()).toBe(1)
    })

    it('deleteSchedule removes cron job and deletes from DB', () => {
      const cronJob = makeMockCronJob()
      mockSchedule.mockReturnValue(cronJob)

      const scheduler = new Scheduler()
      scheduler.addCronJob(makeSchedule())
      expect(scheduler.getTaskCount()).toBe(1)

      scheduler.deleteSchedule('sched-1')

      expect(cronJob.stop).toHaveBeenCalled()
      expect(scheduler.getTaskCount()).toBe(0)
      expect(mockDelete).toHaveBeenCalledWith('sched-1')
    })

    it('toggleSchedule(true) adds cron job when started', () => {
      const updated = makeSchedule({ enabled: true })
      mockGetById.mockReturnValue(updated)

      const scheduler = new Scheduler()
      scheduler.start()
      const result = scheduler.toggleSchedule('sched-1', true)

      expect(mockToggle).toHaveBeenCalledWith('sched-1', true)
      expect(result).toEqual(updated)
      expect(scheduler.getTaskCount()).toBe(1)
    })

    it('toggleSchedule(false) removes cron job', () => {
      const cronJob = makeMockCronJob()
      mockSchedule.mockReturnValue(cronJob)
      const updated = makeSchedule({ enabled: false })
      mockGetById.mockReturnValue(updated)

      const scheduler = new Scheduler()
      scheduler.addCronJob(makeSchedule())
      expect(scheduler.getTaskCount()).toBe(1)

      scheduler.toggleSchedule('sched-1', false)

      expect(cronJob.stop).toHaveBeenCalled()
      expect(scheduler.getTaskCount()).toBe(0)
    })

    it('listSchedules delegates to repo', () => {
      const schedules = [makeSchedule(), makeSchedule({ id: 'sched-2' })]
      mockList.mockReturnValue(schedules)

      const scheduler = new Scheduler()
      expect(scheduler.listSchedules()).toEqual(schedules)
      expect(mockList).toHaveBeenCalled()
    })
  })
})
