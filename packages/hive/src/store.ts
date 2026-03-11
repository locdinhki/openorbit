import { v4 as uuid } from 'uuid'
import { eq, and, desc, or, isNull, lte } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import type { Db } from './db/index.js'
import {
  devices,
  tasks,
  taskResults,
  schedules,
  workflows,
  workflowRuns,
  workflowStepRuns,
  deviceGroups
} from './db/schema.js'
import type { WorkflowStep } from './db/schema.js'
import type { ConnectedMinion, TaskStatus, TaskPriority } from './types.js'

type Device = typeof devices.$inferSelect
type Task = typeof tasks.$inferSelect
type TaskResult = typeof taskResults.$inferSelect
export type Workflow = typeof workflows.$inferSelect
export type WorkflowRun = typeof workflowRuns.$inferSelect
export type WorkflowStepRun = typeof workflowStepRuns.$inferSelect
export type Schedule = typeof schedules.$inferSelect
export type DeviceGroup = typeof deviceGroups.$inferSelect

const BCRYPT_ROUNDS = 10

/**
 * PostgreSQL-backed store (Phase 3).
 * Connections remain in-memory (ephemeral WebSocket state).
 */
export class Store {
  private connections = new Map<string, ConnectedMinion>()

  constructor(private db: Db) {}

  // ── Devices ─────────────────────────────────────────────────────────────

  async registerDevice(opts: {
    id: string
    hardwareId: string
    name: string
    type: 'minion' | 'controller'
    apiKey: string // plain text — hashed before storage
    capabilities?: string[]
    locationTag?: string
  }): Promise<Device> {
    const apiKeyHash = await bcrypt.hash(opts.apiKey, BCRYPT_ROUNDS)
    const [device] = await this.db
      .insert(devices)
      .values({
        id: opts.id,
        hardwareId: opts.hardwareId || null,
        apiKeyHash,
        name: opts.name,
        type: opts.type,
        capabilities: opts.capabilities ?? [],
        locationTag: opts.locationTag
      })
      .returning()
    return device
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const [device] = await this.db.select().from(devices).where(eq(devices.id, id))
    return device
  }

  async getDeviceByApiKey(apiKey: string): Promise<Device | undefined> {
    const allDevices = await this.db.select().from(devices)
    for (const d of allDevices) {
      if (await bcrypt.compare(apiKey, d.apiKeyHash)) return d
    }
    return undefined
  }

  async getDeviceByHardwareId(hardwareId: string): Promise<Device | undefined> {
    const [device] = await this.db.select().from(devices).where(eq(devices.hardwareId, hardwareId))
    return device
  }

  async listDevices(): Promise<Device[]> {
    return this.db.select().from(devices).orderBy(desc(devices.createdAt))
  }

  async setDeviceOnline(
    id: string,
    ip?: string,
    hardwareInfo?: Record<string, unknown>
  ): Promise<void> {
    await this.db
      .update(devices)
      .set({
        status: 'online',
        lastSeenAt: new Date(),
        ...(ip && { ipAddress: ip }),
        ...(hardwareInfo && { hardwareInfo }),
        updatedAt: new Date()
      })
      .where(eq(devices.id, id))
  }

  async setDeviceOffline(id: string): Promise<void> {
    await this.db
      .update(devices)
      .set({ status: 'offline', updatedAt: new Date() })
      .where(eq(devices.id, id))
  }

  async updateDeviceHardwareId(id: string, hardwareId: string): Promise<void> {
    await this.db
      .update(devices)
      .set({ hardwareId, updatedAt: new Date() })
      .where(eq(devices.id, id))
  }

  // ── Connections (in-memory — ephemeral WS state) ────────────────────────

  addConnection(conn: ConnectedMinion): void {
    this.connections.set(conn.deviceId, conn)
  }

  removeConnection(deviceId: string): void {
    this.connections.delete(deviceId)
  }

  getConnection(deviceId: string): ConnectedMinion | undefined {
    return this.connections.get(deviceId)
  }

  // ── Tasks ───────────────────────────────────────────────────────────────

  async createTask(opts: {
    targetDevice?: string
    createdBy?: string
    priority?: TaskPriority
    instruction: Record<string, unknown>
  }): Promise<Task> {
    const [task] = await this.db
      .insert(tasks)
      .values({
        id: uuid(),
        createdBy: opts.createdBy,
        targetDevice: opts.targetDevice,
        priority: opts.priority ?? 'normal',
        instruction: opts.instruction
      })
      .returning()
    return task
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await this.db.select().from(tasks).where(eq(tasks.id, id))
    return task
  }

  async listTasks(filter?: {
    status?: TaskStatus
    deviceId?: string
    limit?: number
  }): Promise<Task[]> {
    let query = this.db.select().from(tasks).$dynamic()
    const conditions = []
    if (filter?.status) conditions.push(eq(tasks.status, filter.status))
    if (filter?.deviceId) conditions.push(eq(tasks.targetDevice, filter.deviceId))
    if (conditions.length) query = query.where(and(...conditions))
    query = query.orderBy(desc(tasks.createdAt))
    if (filter?.limit) query = query.limit(filter.limit)
    return query
  }

  async updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    const updates: Record<string, unknown> = { status }
    if (status === 'dispatched') updates.dispatchedAt = new Date()
    if (status === 'completed' || status === 'failed' || status === 'timeout') {
      updates.completedAt = new Date()
    }
    await this.db.update(tasks).set(updates).where(eq(tasks.id, id))
  }

  async getQueuedTasksForDevice(deviceId: string): Promise<Task[]> {
    return this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'queued'),
          or(eq(tasks.targetDevice, deviceId), isNull(tasks.targetDevice))
        )
      )
  }

  // ── Results ─────────────────────────────────────────────────────────────

  async addResult(result: {
    taskId: string
    deviceId: string
    status: 'success' | 'error' | 'timeout'
    result?: Record<string, unknown>
    error?: string
    durationMs?: number
  }): Promise<TaskResult> {
    const [full] = await this.db
      .insert(taskResults)
      .values({
        id: uuid(),
        taskId: result.taskId,
        deviceId: result.deviceId,
        status: result.status,
        result: result.result,
        error: result.error,
        durationMs: result.durationMs?.toString()
      })
      .returning()
    return full
  }

  async getResults(taskId: string): Promise<TaskResult[]> {
    return this.db.select().from(taskResults).where(eq(taskResults.taskId, taskId))
  }

  // ── Schedules ──────────────────────────────────────────────────────────

  async createSchedule(opts: {
    deviceId: string
    name: string
    instruction: Record<string, unknown>
    cronExpression: string
    nextRunAt?: Date
  }): Promise<Schedule> {
    const [schedule] = await this.db
      .insert(schedules)
      .values({
        id: uuid(),
        deviceId: opts.deviceId,
        name: opts.name,
        instruction: opts.instruction,
        cronExpression: opts.cronExpression,
        nextRunAt: opts.nextRunAt
      })
      .returning()
    return schedule
  }

  async getSchedule(id: string): Promise<Schedule | undefined> {
    const [schedule] = await this.db.select().from(schedules).where(eq(schedules.id, id))
    return schedule
  }

  async listSchedules(filter?: { deviceId?: string }): Promise<Schedule[]> {
    let query = this.db.select().from(schedules).$dynamic()
    if (filter?.deviceId) query = query.where(eq(schedules.deviceId, filter.deviceId))
    return query.orderBy(desc(schedules.createdAt))
  }

  async updateSchedule(
    id: string,
    updates: {
      enabled?: boolean
      cronExpression?: string
      name?: string
      instruction?: Record<string, unknown>
      nextRunAt?: Date
    }
  ): Promise<Schedule | undefined> {
    const [updated] = await this.db
      .update(schedules)
      .set(updates)
      .where(eq(schedules.id, id))
      .returning()
    return updated
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.db.delete(schedules).where(eq(schedules.id, id))
  }

  async getDueSchedules(): Promise<Schedule[]> {
    return this.db
      .select()
      .from(schedules)
      .where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, new Date())))
  }

  async markScheduleRan(id: string, nextRunAt: Date): Promise<void> {
    await this.db
      .update(schedules)
      .set({ lastRunAt: new Date(), nextRunAt })
      .where(eq(schedules.id, id))
  }

  // ── Workflows ──────────────────────────────────────────────────────────

  async createWorkflow(opts: {
    name: string
    description?: string
    steps: WorkflowStep[]
  }): Promise<Workflow> {
    const [workflow] = await this.db
      .insert(workflows)
      .values({ id: uuid(), name: opts.name, description: opts.description, steps: opts.steps })
      .returning()
    return workflow
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const [workflow] = await this.db.select().from(workflows).where(eq(workflows.id, id))
    return workflow
  }

  async listWorkflows(): Promise<Workflow[]> {
    return this.db.select().from(workflows).orderBy(desc(workflows.createdAt))
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.db.delete(workflows).where(eq(workflows.id, id))
  }

  // ── Workflow Runs ───────────────────────────────────────────────────────

  async createWorkflowRun(workflowId: string): Promise<WorkflowRun> {
    const [run] = await this.db
      .insert(workflowRuns)
      .values({ id: uuid(), workflowId, startedAt: new Date() })
      .returning()
    return run
  }

  async getWorkflowRun(id: string): Promise<WorkflowRun | undefined> {
    const [run] = await this.db.select().from(workflowRuns).where(eq(workflowRuns.id, id))
    return run
  }

  async listWorkflowRuns(workflowId: string): Promise<WorkflowRun[]> {
    return this.db
      .select()
      .from(workflowRuns)
      .where(eq(workflowRuns.workflowId, workflowId))
      .orderBy(desc(workflowRuns.createdAt))
  }

  async updateWorkflowRun(
    id: string,
    updates: {
      status?: 'pending' | 'running' | 'completed' | 'failed'
      currentStep?: number
      context?: Record<string, string>
      completedAt?: Date
    }
  ): Promise<void> {
    await this.db.update(workflowRuns).set(updates).where(eq(workflowRuns.id, id))
  }

  async getWorkflowStepRuns(runId: string): Promise<WorkflowStepRun[]> {
    return this.db
      .select()
      .from(workflowStepRuns)
      .where(eq(workflowStepRuns.runId, runId))
      .orderBy(workflowStepRuns.stepIndex)
  }

  async createStepRun(opts: { runId: string; stepIndex: number }): Promise<WorkflowStepRun> {
    const [stepRun] = await this.db
      .insert(workflowStepRuns)
      .values({ id: uuid(), runId: opts.runId, stepIndex: opts.stepIndex })
      .returning()
    return stepRun
  }

  async updateStepRun(
    id: string,
    updates: {
      status?: 'pending' | 'running' | 'completed' | 'failed'
      taskId?: string
      output?: Record<string, unknown>
      error?: string
      startedAt?: Date
      completedAt?: Date
    }
  ): Promise<void> {
    await this.db.update(workflowStepRuns).set(updates).where(eq(workflowStepRuns.id, id))
  }

  // ── Device Groups ──────────────────────────────────────────────────────

  async createGroup(opts: {
    name: string
    description?: string
    tagFilter: string
  }): Promise<DeviceGroup> {
    const [group] = await this.db
      .insert(deviceGroups)
      .values({
        id: uuid(),
        name: opts.name,
        description: opts.description,
        tagFilter: opts.tagFilter
      })
      .returning()
    return group
  }

  async getGroup(id: string): Promise<DeviceGroup | undefined> {
    const [group] = await this.db.select().from(deviceGroups).where(eq(deviceGroups.id, id))
    return group
  }

  async listGroups(): Promise<DeviceGroup[]> {
    return this.db.select().from(deviceGroups).orderBy(deviceGroups.name)
  }

  async deleteGroup(id: string): Promise<void> {
    await this.db.delete(deviceGroups).where(eq(deviceGroups.id, id))
  }

  async getGroupMembers(group: DeviceGroup): Promise<Device[]> {
    return this.db
      .select()
      .from(devices)
      .where(eq(devices.locationTag, group.tagFilter))
      .orderBy(devices.name)
  }

  async getOnlineGroupMembers(group: DeviceGroup): Promise<Device[]> {
    return this.db
      .select()
      .from(devices)
      .where(and(eq(devices.locationTag, group.tagFilter), eq(devices.status, 'online')))
      .orderBy(devices.name)
  }
}
