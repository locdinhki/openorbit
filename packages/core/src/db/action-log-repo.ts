import { v4 as uuid } from 'uuid'
import { getDatabase } from './database'
import type { ActionLog, ExecutionMethod, ActionType } from '../types'

interface ActionLogRow {
  id: string
  timestamp: string
  site: string
  url: string
  intent: string
  page_snapshot: string
  hint_used: string
  execution_method: string
  action_type: string
  action_target: string
  action_value: string | null
  success: number
  error_message: string | null
  corrected_target: string | null
  corrected_value: string | null
}

function rowToActionLog(row: ActionLogRow): ActionLog {
  return {
    id: row.id,
    timestamp: row.timestamp,
    site: row.site,
    url: row.url,
    intent: row.intent,
    pageSnapshot: row.page_snapshot,
    hintUsed: JSON.parse(row.hint_used),
    executionMethod: row.execution_method as ExecutionMethod,
    action: {
      type: row.action_type as ActionType,
      target: row.action_target,
      value: row.action_value ?? undefined
    },
    success: row.success === 1,
    errorMessage: row.error_message ?? undefined,
    correctedAction: row.corrected_target
      ? { target: row.corrected_target, value: row.corrected_value ?? undefined }
      : undefined
  }
}

export class ActionLogRepo {
  insert(log: Omit<ActionLog, 'id' | 'timestamp'>): ActionLog {
    const db = getDatabase()
    const id = uuid()
    const timestamp = new Date().toISOString()

    db.prepare(
      `INSERT INTO action_logs (
        id, timestamp, site, url, intent, page_snapshot, hint_used,
        execution_method, action_type, action_target, action_value,
        success, error_message, corrected_target, corrected_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      timestamp,
      log.site,
      log.url,
      log.intent,
      log.pageSnapshot,
      JSON.stringify(log.hintUsed),
      log.executionMethod,
      log.action.type,
      log.action.target,
      log.action.value ?? null,
      log.success ? 1 : 0,
      log.errorMessage ?? null,
      log.correctedAction?.target ?? null,
      log.correctedAction?.value ?? null
    )

    return { ...log, id, timestamp }
  }

  list(filters?: {
    site?: string
    success?: boolean
    limit?: number
    offset?: number
  }): ActionLog[] {
    const db = getDatabase()
    const conditions: string[] = []
    const params: unknown[] = []

    if (filters?.site) {
      conditions.push('site = ?')
      params.push(filters.site)
    }
    if (filters?.success !== undefined) {
      conditions.push('success = ?')
      params.push(filters.success ? 1 : 0)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = filters?.limit ? `LIMIT ${filters.limit}` : ''
    const offset = filters?.offset ? `OFFSET ${filters.offset}` : ''

    const rows = db
      .prepare(`SELECT * FROM action_logs ${where} ORDER BY timestamp DESC ${limit} ${offset}`)
      .all(...params) as ActionLogRow[]

    return rows.map(rowToActionLog)
  }

  getRecent(count: number = 50): ActionLog[] {
    return this.list({ limit: count })
  }

  addCorrection(id: string, correctedAction: { target: string; value?: string }): void {
    const db = getDatabase()
    db.prepare('UPDATE action_logs SET corrected_target = ?, corrected_value = ? WHERE id = ?').run(
      correctedAction.target,
      correctedAction.value ?? null,
      id
    )
  }

  getTrainingData(): ActionLog[] {
    const db = getDatabase()
    const rows = db
      .prepare(
        'SELECT * FROM action_logs WHERE success = 1 OR corrected_target IS NOT NULL ORDER BY timestamp'
      )
      .all() as ActionLogRow[]
    return rows.map(rowToActionLog)
  }

  count(): number {
    const db = getDatabase()
    const row = db.prepare('SELECT COUNT(*) as count FROM action_logs').get() as { count: number }
    return row.count
  }
}
