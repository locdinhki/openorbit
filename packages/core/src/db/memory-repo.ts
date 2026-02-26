import { v4 as uuid } from 'uuid'
import { getDatabase } from './database'

export type MemoryCategory = 'preference' | 'company' | 'pattern' | 'answer'

export interface MemoryFact {
  id: string
  category: MemoryCategory
  content: string
  source: string
  confidence: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  accessedAt: string
  accessCount: number
}

export interface MemorySearchResult {
  fact: MemoryFact
  score: number
}

interface MemoryRow {
  id: string
  category: string
  content: string
  source: string
  confidence: number
  metadata: string
  embedding: Buffer | null
  created_at: string
  updated_at: string
  accessed_at: string
  access_count: number
}

interface FTSMatchRow {
  id: string
  category: string
  content: string
  source: string
  confidence: number
  metadata: string
  created_at: string
  updated_at: string
  accessed_at: string
  access_count: number
  rank: number
}

function rowToFact(row: MemoryRow | FTSMatchRow): MemoryFact {
  let metadata: Record<string, unknown> = {}
  try {
    metadata = JSON.parse(row.metadata)
  } catch {
    // ignore
  }
  return {
    id: row.id,
    category: row.category as MemoryCategory,
    content: row.content,
    source: row.source,
    confidence: row.confidence,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessedAt: row.accessed_at,
    accessCount: row.access_count
  }
}

export class MemoryRepo {
  addFact(
    category: MemoryCategory,
    content: string,
    source = 'user',
    confidence = 1.0,
    metadata: Record<string, unknown> = {}
  ): MemoryFact {
    const db = getDatabase()
    const id = uuid()
    const metadataJson = JSON.stringify(metadata)

    db.prepare(
      `INSERT INTO memory_facts (id, category, content, source, confidence, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, category, content, source, confidence, metadataJson)

    return this.getById(id)!
  }

  updateFact(
    id: string,
    updates: {
      content?: string
      confidence?: number
      metadata?: Record<string, unknown>
    }
  ): void {
    const db = getDatabase()
    const sets: string[] = []
    const params: unknown[] = []

    if (updates.content !== undefined) {
      sets.push('content = ?')
      params.push(updates.content)
    }
    if (updates.confidence !== undefined) {
      sets.push('confidence = ?')
      params.push(updates.confidence)
    }
    if (updates.metadata !== undefined) {
      sets.push('metadata = ?')
      params.push(JSON.stringify(updates.metadata))
    }

    if (sets.length === 0) return

    sets.push("updated_at = datetime('now')")
    params.push(id)

    db.prepare(`UPDATE memory_facts SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  deleteFact(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM memory_facts WHERE id = ?').run(id)
  }

  getById(id: string): MemoryFact | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM memory_facts WHERE id = ?').get(id) as
      | MemoryRow
      | undefined
    if (!row) return null

    // Touch access tracking
    db.prepare(
      "UPDATE memory_facts SET accessed_at = datetime('now'), access_count = access_count + 1 WHERE id = ?"
    ).run(id)

    return rowToFact(row)
  }

  getByCategory(category: MemoryCategory, limit = 50): MemoryFact[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM memory_facts WHERE category = ? ORDER BY updated_at DESC LIMIT ?')
      .all(category, limit) as MemoryRow[]
    return rows.map(rowToFact)
  }

  getRecentFacts(limit = 20, category?: MemoryCategory): MemoryFact[] {
    const db = getDatabase()
    if (category) {
      const rows = db
        .prepare('SELECT * FROM memory_facts WHERE category = ? ORDER BY accessed_at DESC LIMIT ?')
        .all(category, limit) as MemoryRow[]
      return rows.map(rowToFact)
    }
    const rows = db
      .prepare('SELECT * FROM memory_facts ORDER BY accessed_at DESC LIMIT ?')
      .all(limit) as MemoryRow[]
    return rows.map(rowToFact)
  }

  listAll(limit = 100): MemoryFact[] {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM memory_facts ORDER BY updated_at DESC LIMIT ?')
      .all(limit) as MemoryRow[]
    return rows.map(rowToFact)
  }

  /**
   * Hybrid search: FTS5 keyword matching.
   * Vector similarity can be added later when embeddings are populated.
   */
  search(
    query: string,
    options: {
      category?: MemoryCategory
      limit?: number
      minConfidence?: number
    } = {}
  ): MemorySearchResult[] {
    const db = getDatabase()
    const limit = options.limit ?? 10
    const minConfidence = options.minConfidence ?? 0

    // FTS5 keyword search
    const ftsResults = this.ftsSearch(db, query, options.category, limit, minConfidence)

    return ftsResults
  }

  private ftsSearch(
    db: ReturnType<typeof getDatabase>,
    query: string,
    category: MemoryCategory | undefined,
    limit: number,
    minConfidence: number
  ): MemorySearchResult[] {
    // Sanitize FTS5 query: escape special characters and wrap terms in quotes
    const sanitized = query
      .replace(/['"]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 0)
      .map((t) => `"${t}"`)
      .join(' OR ')

    if (!sanitized) return []

    let sql = `
      SELECT mf.*, fts.rank
      FROM memory_facts_fts fts
      JOIN memory_facts mf ON mf.rowid = fts.rowid
      WHERE memory_facts_fts MATCH ?
    `
    const params: unknown[] = [sanitized]

    if (category) {
      sql += ' AND mf.category = ?'
      params.push(category)
    }
    if (minConfidence > 0) {
      sql += ' AND mf.confidence >= ?'
      params.push(minConfidence)
    }

    sql += ' ORDER BY fts.rank LIMIT ?'
    params.push(limit)

    const rows = db.prepare(sql).all(...params) as FTSMatchRow[]

    return rows.map((row) => ({
      fact: rowToFact(row),
      score: Math.abs(row.rank) // FTS5 rank is negative (more negative = better match)
    }))
  }
}
