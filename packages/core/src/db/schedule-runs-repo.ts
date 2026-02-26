import { randomUUID } from 'crypto'
import { getDatabase } from './database'

export interface ScheduleRun {
  id: string
  scheduleId: string
  status: 'success' | 'error' | 'running'
  errorMessage: string | null
  durationMs: number | null
  startedAt: string
  completedAt: string | null
}

interface ScheduleRunRow {
  id: string
  schedule_id: string
  status: string
  error_message: string | null
  duration_ms: number | null
  started_at: string
  completed_at: string | null
}

function rowToRun(row: ScheduleRunRow): ScheduleRun {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    status: row.status as ScheduleRun['status'],
    errorMessage: row.error_message,
    durationMs: row.duration_ms,
    startedAt: row.started_at,
    completedAt: row.completed_at
  }
}

export class ScheduleRunsRepo {
  /** Insert a new run with status='running', returns the run ID */
  insertStart(scheduleId: string): string {
    const db = getDatabase()
    const id = randomUUID()
    db.prepare(
      `INSERT INTO schedule_runs (id, schedule_id, status) VALUES (?, ?, 'running')`
    ).run(id, scheduleId)
    return id
  }

  /** Complete a run with final status, error message, and duration */
  complete(
    runId: string,
    result: { status: 'success' | 'error'; errorMessage?: string; durationMs: number }
  ): void {
    const db = getDatabase()
    db.prepare(
      `UPDATE schedule_runs
       SET status = ?, error_message = ?, duration_ms = ?, completed_at = datetime('now')
       WHERE id = ?`
    ).run(result.status, result.errorMessage ?? null, result.durationMs, runId)
  }

  /** List runs for a schedule, ordered by most recent first */
  listBySchedule(scheduleId: string, limit = 20, offset = 0): ScheduleRun[] {
    const db = getDatabase()
    const rows = db
      .prepare(
        `SELECT * FROM schedule_runs
         WHERE schedule_id = ?
         ORDER BY started_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(scheduleId, limit, offset) as ScheduleRunRow[]
    return rows.map(rowToRun)
  }
}
