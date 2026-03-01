// ============================================================================
// ext-docs — Documents Repository
// ============================================================================

import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type {
  Document,
  DocumentListRequest,
  DocumentCreateRequest,
  DocumentUpdateRequest,
  DocumentSearchRequest
} from '../../ipc-schemas'

interface DocumentRow {
  id: string
  title: string
  file_path: string
  file_type: string
  file_size: number | null
  contact_id: string | null
  deal_id: string | null
  property_id: string | null
  template_id: string | null
  tags: string
  metadata: string
  created_at: string
  updated_at: string
}

function rowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    filePath: row.file_path,
    fileType: row.file_type,
    fileSize: row.file_size ?? undefined,
    contactId: row.contact_id ?? undefined,
    dealId: row.deal_id ?? undefined,
    propertyId: row.property_id ?? undefined,
    templateId: row.template_id ?? undefined,
    tags: JSON.parse(row.tags),
    metadata: JSON.parse(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class DocumentsRepo {
  constructor(private db: Database) {}

  list(request: DocumentListRequest): Document[] {
    const conditions: string[] = []
    const params: (string | number)[] = []

    if (request.contactId) {
      conditions.push('contact_id = ?')
      params.push(request.contactId)
    }
    if (request.dealId) {
      conditions.push('deal_id = ?')
      params.push(request.dealId)
    }
    if (request.propertyId) {
      conditions.push('property_id = ?')
      params.push(request.propertyId)
    }
    if (request.fileType) {
      conditions.push('file_type = ?')
      params.push(request.fileType)
    }
    if (request.tags && request.tags.length > 0) {
      // Match any of the specified tags
      const tagConditions = request.tags.map(() => "tags LIKE '%' || ? || '%'")
      conditions.push(`(${tagConditions.join(' OR ')})`)
      params.push(...request.tags)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const sql = `
      SELECT * FROM docs_documents
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `

    params.push(request.limit ?? 100, request.offset ?? 0)

    const rows = this.db.prepare(sql).all(...params) as DocumentRow[]
    return rows.map(rowToDocument)
  }

  get(id: string): Document | null {
    const row = this.db.prepare('SELECT * FROM docs_documents WHERE id = ?').get(id) as
      | DocumentRow
      | undefined

    return row ? rowToDocument(row) : null
  }

  create(request: DocumentCreateRequest): Document {
    const id = randomUUID()
    const now = new Date().toISOString()
    const tags = JSON.stringify(request.tags ?? [])
    const metadata = JSON.stringify(request.metadata ?? {})

    this.db
      .prepare(
        `
      INSERT INTO docs_documents (
        id, title, file_path, file_type, file_size,
        contact_id, deal_id, property_id, template_id,
        tags, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        request.title,
        request.filePath,
        request.fileType,
        request.fileSize ?? null,
        request.contactId ?? null,
        request.dealId ?? null,
        request.propertyId ?? null,
        request.templateId ?? null,
        tags,
        metadata,
        now,
        now
      )

    return this.get(id)!
  }

  update(request: DocumentUpdateRequest): Document | null {
    const existing = this.get(request.id)
    if (!existing) return null

    const updates: string[] = ['updated_at = ?']
    const params: (string | null)[] = [new Date().toISOString()]

    if (request.title !== undefined) {
      updates.push('title = ?')
      params.push(request.title)
    }
    if (request.contactId !== undefined) {
      updates.push('contact_id = ?')
      params.push(request.contactId ?? null)
    }
    if (request.dealId !== undefined) {
      updates.push('deal_id = ?')
      params.push(request.dealId ?? null)
    }
    if (request.propertyId !== undefined) {
      updates.push('property_id = ?')
      params.push(request.propertyId ?? null)
    }
    if (request.tags !== undefined) {
      updates.push('tags = ?')
      params.push(JSON.stringify(request.tags))
    }
    if (request.metadata !== undefined) {
      updates.push('metadata = ?')
      params.push(JSON.stringify(request.metadata))
    }

    params.push(request.id)

    this.db.prepare(`UPDATE docs_documents SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    return this.get(request.id)
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM docs_documents WHERE id = ?').run(id)
    return result.changes > 0
  }

  search(request: DocumentSearchRequest): Document[] {
    const conditions: string[] = []
    const params: (string | number)[] = []

    // Full-text search on title
    if (request.query) {
      conditions.push("title LIKE '%' || ? || '%'")
      params.push(request.query)
    }

    if (request.fileTypes && request.fileTypes.length > 0) {
      const placeholders = request.fileTypes.map(() => '?').join(', ')
      conditions.push(`file_type IN (${placeholders})`)
      params.push(...request.fileTypes)
    }

    if (request.tags && request.tags.length > 0) {
      const tagConditions = request.tags.map(() => "tags LIKE '%' || ? || '%'")
      conditions.push(`(${tagConditions.join(' OR ')})`)
      params.push(...request.tags)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const sql = `
      SELECT * FROM docs_documents
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ?
    `

    params.push(request.limit ?? 50)

    const rows = this.db.prepare(sql).all(...params) as DocumentRow[]
    return rows.map(rowToDocument)
  }

  countByType(): Record<string, number> {
    const rows = this.db
      .prepare(
        `
      SELECT file_type, COUNT(*) as count
      FROM docs_documents
      GROUP BY file_type
    `
      )
      .all() as Array<{ file_type: string; count: number }>

    const result: Record<string, number> = {}
    for (const row of rows) {
      result[row.file_type] = row.count
    }
    return result
  }
}
