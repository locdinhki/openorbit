// ============================================================================
// ext-docs — Templates Repository
// ============================================================================

import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { Template, TemplateListRequest, TemplateSaveRequest } from '../../ipc-schemas'

// Regex to match merge fields: {{field}} or {{nested.field}}
const MERGE_FIELD_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g

interface TemplateRow {
  id: string
  name: string
  description: string | null
  category: string | null
  content: string
  merge_fields: string
  created_at: string
  updated_at: string
}

function rowToTemplate(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    content: row.content,
    mergeFields: JSON.parse(row.merge_fields),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function extractMergeFields(content: string): string[] {
  const fields = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = MERGE_FIELD_REGEX.exec(content)) !== null) {
    fields.add(match[1])
  }

  // Reset regex lastIndex
  MERGE_FIELD_REGEX.lastIndex = 0

  return [...fields].sort()
}

export class TemplatesRepo {
  constructor(private db: Database) {}

  list(request: TemplateListRequest): Template[] {
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (request.category) {
      conditions.push('category = ?')
      params.push(request.category)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const sql = `
      SELECT * FROM docs_templates
      ${whereClause}
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `

    params.push(request.limit ?? 100, request.offset ?? 0)

    const rows = this.db.prepare(sql).all(...params) as TemplateRow[]
    return rows.map(rowToTemplate)
  }

  get(id: string): Template | null {
    const row = this.db.prepare('SELECT * FROM docs_templates WHERE id = ?').get(id) as
      | TemplateRow
      | undefined

    return row ? rowToTemplate(row) : null
  }

  save(request: TemplateSaveRequest): Template {
    const now = new Date().toISOString()
    const mergeFields = JSON.stringify(extractMergeFields(request.content))

    if (request.id) {
      // Update existing template
      const existing = this.get(request.id)
      if (!existing) {
        throw new Error(`Template not found: ${request.id}`)
      }

      this.db
        .prepare(
          `
        UPDATE docs_templates
        SET name = ?, description = ?, category = ?, content = ?, merge_fields = ?, updated_at = ?
        WHERE id = ?
      `
        )
        .run(
          request.name,
          request.description ?? null,
          request.category ?? null,
          request.content,
          mergeFields,
          now,
          request.id
        )

      return this.get(request.id)!
    } else {
      // Create new template
      const id = randomUUID()

      this.db
        .prepare(
          `
        INSERT INTO docs_templates (
          id, name, description, category, content, merge_fields, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          id,
          request.name,
          request.description ?? null,
          request.category ?? null,
          request.content,
          mergeFields,
          now,
          now
        )

      return this.get(id)!
    }
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM docs_templates WHERE id = ?').run(id)
    return result.changes > 0
  }

  getCategories(): string[] {
    const rows = this.db
      .prepare(
        `
      SELECT DISTINCT category FROM docs_templates
      WHERE category IS NOT NULL
      ORDER BY category ASC
    `
      )
      .all() as Array<{ category: string }>

    return rows.map((r) => r.category)
  }
}
