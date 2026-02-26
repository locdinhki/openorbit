import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { SchedulesRepo } from '../db/schedules-repo'
import type { Schedule } from '../db/schedules-repo'
import { ScheduleRunsRepo } from '../db/schedule-runs-repo'
import type { ScheduleRun } from '../db/schedule-runs-repo'
import { createLogger } from '../utils/logger'
import type { ToolMeta } from './scheduler-types'

const log = createLogger('Scheduler')

interface RunningTask {
  cronJob: ScheduledTask
  isExecuting: boolean
}

interface RegisteredTool {
  handler: (config: Record<string, unknown>) => Promise<void>
  meta: ToolMeta
}

export interface SchedulerEvents {
  onRunStart?: (scheduleId: string) => void
  onRunComplete?: (
    scheduleId: string,
    result: { status: 'success' | 'error'; error?: string; durationMs: number }
  ) => void
}

export class Scheduler {
  private tasks: Map<string, RunningTask> = new Map()
  private taskHandlers: Map<string, RegisteredTool> = new Map()
  private schedulesRepo = new SchedulesRepo()
  private runsRepo = new ScheduleRunsRepo()
  private started = false
  private events: SchedulerEvents
  /** Track executing schedule IDs for triggerNow overlap detection */
  private executingIds = new Set<string>()

  constructor(events?: SchedulerEvents) {
    this.events = events ?? {}
  }

  /** Load all enabled schedules and register cron jobs */
  start(): void {
    if (this.started) return
    this.started = true

    const schedules = this.schedulesRepo.listEnabled()
    for (const schedule of schedules) {
      this.addCronJob(schedule)
    }
    log.info(`Scheduler started with ${schedules.length} active schedules`)
  }

  /** Stop all cron jobs */
  stop(): void {
    for (const [id, task] of this.tasks) {
      task.cronJob.stop()
      log.info(`Stopped cron job: ${id}`)
    }
    this.tasks.clear()
    this.started = false
    log.info('Scheduler stopped')
  }

  /** Register a cron job for a schedule */
  addCronJob(schedule: Schedule): void {
    if (!cron.validate(schedule.cronExpression)) {
      log.warn(`Invalid cron expression for schedule ${schedule.id}: ${schedule.cronExpression}`)
      return
    }

    // Remove existing job if present
    this.removeCronJob(schedule.id)

    const runningTask: RunningTask = {
      cronJob: cron.schedule(schedule.cronExpression, () => {
        this.executeTask(schedule.id, runningTask).catch((err) => {
          log.error(`Task execution error for schedule ${schedule.id}`, err)
        })
      }),
      isExecuting: false
    }

    this.tasks.set(schedule.id, runningTask)
    log.info(`Registered cron job: ${schedule.name} (${schedule.cronExpression})`)
  }

  /** Remove a cron job by schedule ID */
  removeCronJob(id: string): void {
    const existing = this.tasks.get(id)
    if (existing) {
      existing.cronJob.stop()
      this.tasks.delete(id)
    }
  }

  /** Check if any task is currently executing */
  isExecuting(id: string): boolean {
    return (this.tasks.get(id)?.isExecuting ?? false) || this.executingIds.has(id)
  }

  /** Get count of registered cron jobs */
  getTaskCount(): number {
    return this.tasks.size
  }

  isStarted(): boolean {
    return this.started
  }

  // ---------------------------------------------------------------------------
  // Manual trigger
  // ---------------------------------------------------------------------------

  /** Trigger a schedule for immediate execution */
  async triggerNow(scheduleId: string): Promise<void> {
    const schedule = this.schedulesRepo.getById(scheduleId)
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`)
    }

    if (this.isExecuting(scheduleId)) {
      throw new Error(`Schedule is already executing: ${scheduleId}`)
    }

    // Execute directly (no cron job needed)
    this.executingIds.add(scheduleId)
    const startTime = Date.now()
    const runId = this.runsRepo.insertStart(scheduleId)

    this.events.onRunStart?.(scheduleId)
    log.info(`Manual trigger: ${schedule.name} (${schedule.taskType})`)

    try {
      await this.runTaskType(schedule.taskType, schedule.config ?? {})

      const durationMs = Date.now() - startTime
      this.runsRepo.complete(runId, { status: 'success', durationMs })
      this.schedulesRepo.updateRunStatus(scheduleId, { lastRunStatus: 'success' })

      this.events.onRunComplete?.(scheduleId, { status: 'success', durationMs })
      log.info(`Manual trigger completed: ${schedule.name} (${durationMs}ms)`)
    } catch (err) {
      const durationMs = Date.now() - startTime
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.runsRepo.complete(runId, { status: 'error', errorMessage: errorMsg, durationMs })
      this.schedulesRepo.updateRunStatus(scheduleId, {
        lastRunStatus: 'error',
        lastRunError: errorMsg
      })

      this.events.onRunComplete?.(scheduleId, { status: 'error', error: errorMsg, durationMs })
      log.error(`Manual trigger failed: ${schedule.name}`, err)
      throw err
    } finally {
      this.executingIds.delete(scheduleId)
    }
  }

  // ---------------------------------------------------------------------------
  // Run history
  // ---------------------------------------------------------------------------

  /** List runs for a schedule */
  listRuns(scheduleId: string, limit = 20, offset = 0): ScheduleRun[] {
    return this.runsRepo.listBySchedule(scheduleId, limit, offset)
  }

  // ---------------------------------------------------------------------------
  // Tool registration
  // ---------------------------------------------------------------------------

  /** Register a handler for a task type with metadata. Extensions call this on activation. */
  registerTaskType(
    taskType: string,
    handler: (config: Record<string, unknown>) => Promise<void>,
    meta: Omit<ToolMeta, 'taskType'>
  ): void {
    this.taskHandlers.set(taskType, {
      handler,
      meta: { taskType, ...meta }
    })
    log.info(`Registered handler for task type: ${taskType}`)
  }

  /** Return metadata for all registered tools */
  listTools(): ToolMeta[] {
    return [...this.taskHandlers.values()].map((entry) => entry.meta)
  }

  // ---------------------------------------------------------------------------
  // Schedule CRUD (manages both DB + live cron state)
  // ---------------------------------------------------------------------------

  /** List all schedules */
  listSchedules(): Schedule[] {
    return this.schedulesRepo.list()
  }

  /** Create a schedule and register its cron job if enabled */
  createSchedule(input: {
    name: string
    taskType: string
    cronExpression: string
    enabled?: boolean
    config?: Record<string, unknown>
  }): Schedule {
    const schedule = this.schedulesRepo.create(input)
    if (schedule.enabled && this.started) {
      this.addCronJob(schedule)
    }
    log.info(`Created schedule: ${schedule.name} (${schedule.id})`)
    return schedule
  }

  /** Update a schedule and re-register its cron job */
  updateSchedule(
    id: string,
    updates: Partial<{
      name: string
      cronExpression: string
      enabled: boolean
      config: Record<string, unknown>
    }>
  ): Schedule | null {
    this.schedulesRepo.update(id, updates)
    const updated = this.schedulesRepo.getById(id)
    if (!updated) return null

    // Re-register cron job with new settings
    this.removeCronJob(id)
    if (updated.enabled && this.started) {
      this.addCronJob(updated)
    }

    log.info(`Updated schedule: ${updated.name} (${id})`)
    return updated
  }

  /** Delete a schedule and remove its cron job */
  deleteSchedule(id: string): void {
    this.removeCronJob(id)
    this.schedulesRepo.delete(id)
    log.info(`Deleted schedule: ${id}`)
  }

  /** Toggle a schedule's enabled state and start/stop its cron job */
  toggleSchedule(id: string, enabled: boolean): Schedule | null {
    this.schedulesRepo.toggle(id, enabled)
    const updated = this.schedulesRepo.getById(id)
    if (!updated) return null

    if (enabled && this.started) {
      this.addCronJob(updated)
    } else {
      this.removeCronJob(id)
    }

    log.info(`Toggled schedule ${id}: enabled=${enabled}`)
    return updated
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async executeTask(scheduleId: string, runningTask: RunningTask): Promise<void> {
    // Overlap prevention: skip if already executing
    if (runningTask.isExecuting) {
      log.warn(`Skipping overlapping execution for schedule ${scheduleId}`)
      return
    }

    const schedule = this.schedulesRepo.getById(scheduleId)
    if (!schedule || !schedule.enabled) {
      log.info(`Schedule ${scheduleId} disabled or deleted, skipping`)
      return
    }

    runningTask.isExecuting = true
    const startTime = Date.now()
    const runId = this.runsRepo.insertStart(scheduleId)
    this.events.onRunStart?.(scheduleId)
    log.info(`Executing task: ${schedule.name} (${schedule.taskType})`)

    try {
      await this.runTaskType(schedule.taskType, schedule.config ?? {})

      const durationMs = Date.now() - startTime
      this.runsRepo.complete(runId, { status: 'success', durationMs })
      this.schedulesRepo.updateRunStatus(scheduleId, {
        lastRunStatus: 'success'
      })
      this.events.onRunComplete?.(scheduleId, { status: 'success', durationMs })
      log.info(`Task completed: ${schedule.name} (${durationMs}ms)`)
    } catch (err) {
      const durationMs = Date.now() - startTime
      const errorMsg = err instanceof Error ? err.message : String(err)
      this.runsRepo.complete(runId, { status: 'error', errorMessage: errorMsg, durationMs })
      this.schedulesRepo.updateRunStatus(scheduleId, {
        lastRunStatus: 'error',
        lastRunError: errorMsg
      })
      this.events.onRunComplete?.(scheduleId, { status: 'error', error: errorMsg, durationMs })
      log.error(`Task failed: ${schedule.name}`, err)
    } finally {
      runningTask.isExecuting = false
    }
  }

  private async runTaskType(taskType: string, config: Record<string, unknown>): Promise<void> {
    const entry = this.taskHandlers.get(taskType)
    if (!entry) {
      log.warn(`No handler registered for task type: ${taskType}`)
      return
    }
    await entry.handler(config)
  }
}
