import { v4 as uuid } from 'uuid'
import { eq, and, desc, or, isNull } from 'drizzle-orm'
import bcrypt from 'bcrypt'
import type { Db } from './db/index.js'
import { devices, tasks, taskResults } from './db/schema.js'
import type { ConnectedMinion, TaskStatus, TaskPriority } from './types.js'

type Device = typeof devices.$inferSelect
type Task = typeof tasks.$inferSelect
type TaskResult = typeof taskResults.$inferSelect

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

  async listTasks(filter?: { status?: TaskStatus; deviceId?: string }): Promise<Task[]> {
    let query = this.db.select().from(tasks).$dynamic()
    const conditions = []
    if (filter?.status) conditions.push(eq(tasks.status, filter.status))
    if (filter?.deviceId) conditions.push(eq(tasks.targetDevice, filter.deviceId))
    if (conditions.length) query = query.where(and(...conditions))
    return query.orderBy(desc(tasks.createdAt))
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
}
