import { v4 as uuid } from 'uuid'
import type Database from 'better-sqlite3'
import { getDatabase } from '@openorbit/core/db/database'

export interface AnswerTemplate {
  id: string
  questionPattern: string
  answer: string
  platform?: string
  usageCount: number
  lastUsedAt?: string
  createdAt: string
  updatedAt: string
}

interface AnswerRow {
  id: string
  question_pattern: string
  answer: string
  platform: string | null
  usage_count: number
  last_used_at: string | null
  created_at: string
  updated_at: string
}

function rowToTemplate(row: AnswerRow): AnswerTemplate {
  return {
    id: row.id,
    questionPattern: row.question_pattern,
    answer: row.answer,
    platform: row.platform ?? undefined,
    usageCount: row.usage_count,
    lastUsedAt: row.last_used_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class AnswersRepo {
  private db: Database.Database
  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase()
  }

  insert(template: { questionPattern: string; answer: string; platform?: string }): AnswerTemplate {
    const id = uuid()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO answer_templates (id, question_pattern, answer, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, template.questionPattern, template.answer, template.platform ?? null, now, now)

    return this.getById(id)!
  }

  getById(id: string): AnswerTemplate | null {
    const row = this.db.prepare('SELECT * FROM answer_templates WHERE id = ?').get(id) as
      | AnswerRow
      | undefined
    return row ? rowToTemplate(row) : null
  }

  list(platform?: string): AnswerTemplate[] {
    if (platform) {
      const rows = this.db
        .prepare(
          'SELECT * FROM answer_templates WHERE platform = ? OR platform IS NULL ORDER BY usage_count DESC'
        )
        .all(platform) as AnswerRow[]
      return rows.map(rowToTemplate)
    }
    const rows = this.db
      .prepare('SELECT * FROM answer_templates ORDER BY usage_count DESC')
      .all() as AnswerRow[]
    return rows.map(rowToTemplate)
  }

  findMatch(question: string): AnswerTemplate | null {
    const rows = this.db
      .prepare('SELECT * FROM answer_templates ORDER BY usage_count DESC')
      .all() as AnswerRow[]

    const lower = question.toLowerCase()
    for (const row of rows) {
      if (lower.includes(row.question_pattern.toLowerCase())) {
        return rowToTemplate(row)
      }
    }
    return null
  }

  update(
    id: string,
    updates: { questionPattern?: string; answer?: string; platform?: string }
  ): void {
    const sets: string[] = ['updated_at = ?']
    const params: unknown[] = [new Date().toISOString()]

    if (updates.questionPattern !== undefined) {
      sets.push('question_pattern = ?')
      params.push(updates.questionPattern)
    }
    if (updates.answer !== undefined) {
      sets.push('answer = ?')
      params.push(updates.answer)
    }
    if (updates.platform !== undefined) {
      sets.push('platform = ?')
      params.push(updates.platform)
    }

    params.push(id)
    this.db.prepare(`UPDATE answer_templates SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  recordUsage(id: string): void {
    this.db
      .prepare(
        'UPDATE answer_templates SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?'
      )
      .run(new Date().toISOString(), id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM answer_templates WHERE id = ?').run(id)
  }
}
