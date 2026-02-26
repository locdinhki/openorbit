import { randomUUID } from 'crypto'
import { getDatabase } from './database'

/** Task type is a free-form string; extensions register handlers at runtime. */
export type ScheduleTaskType = string

export interface Schedule {
  id: string
  name: string
  taskType: ScheduleTaskType
  cronExpression: string
  enabled: boolean
  config: Record<string, unknown>
  lastRunAt: string | null
  lastRunStatus: string | null
  lastRunError: string | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
}

interface ScheduleRow {
  id: string
  name: string
  task_type: string
  cron_expression: string
  enabled: number
  config: string
  last_run_at: string | null
  last_run_status: string | null
  last_run_error: string | null
  next_run_at: string | null
  created_at: string
  updated_at: string
}

function rowToSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    name: row.name,
    taskType: row.task_type as ScheduleTaskType,
    cronExpression: row.cron_expression,
    enabled: row.enabled === 1,
    config: JSON.parse(row.config),
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status,
    lastRunError: row.last_run_error,
    nextRunAt: row.next_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class SchedulesRepo {
  list(): Schedule[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM schedules ORDER BY created_at DESC')
      .all() as ScheduleRow[]
    return rows.map(rowToSchedule)
  }

  listEnabled(): Schedule[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM schedules WHERE enabled = 1 ORDER BY created_at DESC')
      .all() as ScheduleRow[]
    return rows.map(rowToSchedule)
  }

  getById(id: string): Schedule | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM schedules WHERE id = ?').get(id) as
      | ScheduleRow
      | undefined
    return row ? rowToSchedule(row) : null
  }

  create(input: {
    name: string
    taskType: ScheduleTaskType
    cronExpression: string
    enabled?: boolean
    config?: Record<string, unknown>
  }): Schedule {
    const db = getDatabase()
    const id = randomUUID()
    db.prepare(
      `INSERT INTO schedules (id, name, task_type, cron_expression, enabled, config)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.name,
      input.taskType,
      input.cronExpression,
      input.enabled !== false ? 1 : 0,
      JSON.stringify(input.config ?? {})
    )

    return this.getById(id)!
  }

  update(
    id: string,
    updates: Partial<{
      name: string
      cronExpression: string
      enabled: boolean
      config: Record<string, unknown>
    }>
  ): void {
    const db = getDatabase()
    const sets: string[] = []
    const values: unknown[] = []

    if (updates.name !== undefined) {
      sets.push('name = ?')
      values.push(updates.name)
    }
    if (updates.cronExpression !== undefined) {
      sets.push('cron_expression = ?')
      values.push(updates.cronExpression)
    }
    if (updates.enabled !== undefined) {
      sets.push('enabled = ?')
      values.push(updates.enabled ? 1 : 0)
    }
    if (updates.config !== undefined) {
      sets.push('config = ?')
      values.push(JSON.stringify(updates.config))
    }

    if (sets.length === 0) return

    sets.push("updated_at = datetime('now')")
    values.push(id)

    db.prepare(`UPDATE schedules SET ${sets.join(', ')} WHERE id = ?`).run(...values)
  }

  delete(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM schedules WHERE id = ?').run(id)
  }

  updateRunStatus(
    id: string,
    status: { lastRunStatus: string; lastRunError?: string; nextRunAt?: string }
  ): void {
    const db = getDatabase()
    db.prepare(
      `UPDATE schedules
       SET last_run_at = datetime('now'),
           last_run_status = ?,
           last_run_error = ?,
           next_run_at = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).run(status.lastRunStatus, status.lastRunError ?? null, status.nextRunAt ?? null, id)
  }

  toggle(id: string, enabled: boolean): void {
    const db = getDatabase()
    db.prepare("UPDATE schedules SET enabled = ?, updated_at = datetime('now') WHERE id = ?").run(
      enabled ? 1 : 0,
      id
    )
  }
}
