import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface BkCategoryRow {
  id: string
  name: string
  type: string
  parent_id: string | null
  tax_category: string | null
  sort_order: number
  created_at: string
}

export interface CreateCategoryInput {
  name: string
  type: 'income' | 'expense'
  parentId?: string
  taxCategory?: string
}

export class BkCategoriesRepo {
  constructor(private db: Database.Database) {}

  create(input: CreateCategoryInput): BkCategoryRow {
    const id = randomUUID()
    const sortOrder = this.getMaxSortOrder() + 1

    this.db
      .prepare(
        `INSERT INTO bk_categories (id, name, type, parent_id, tax_category, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.name, input.type, input.parentId ?? null, input.taxCategory ?? null, sortOrder)

    return this.getById(id)!
  }

  private getMaxSortOrder(): number {
    const row = this.db.prepare('SELECT MAX(sort_order) as max FROM bk_categories').get() as {
      max: number | null
    }
    return row.max ?? 0
  }

  getById(id: string): BkCategoryRow | null {
    return (
      (this.db.prepare('SELECT * FROM bk_categories WHERE id = ?').get(id) as
        | BkCategoryRow
        | undefined) ?? null
    )
  }

  list(type?: string): BkCategoryRow[] {
    if (type && type !== 'all') {
      return this.db
        .prepare('SELECT * FROM bk_categories WHERE type = ? ORDER BY sort_order ASC')
        .all(type) as BkCategoryRow[]
    }
    return this.db
      .prepare('SELECT * FROM bk_categories ORDER BY type, sort_order ASC')
      .all() as BkCategoryRow[]
  }

  listByType(type: 'income' | 'expense'): BkCategoryRow[] {
    return this.db
      .prepare('SELECT * FROM bk_categories WHERE type = ? ORDER BY sort_order ASC')
      .all(type) as BkCategoryRow[]
  }

  listWithParent(parentId: string | null): BkCategoryRow[] {
    if (parentId === null) {
      return this.db
        .prepare('SELECT * FROM bk_categories WHERE parent_id IS NULL ORDER BY sort_order ASC')
        .all() as BkCategoryRow[]
    }
    return this.db
      .prepare('SELECT * FROM bk_categories WHERE parent_id = ? ORDER BY sort_order ASC')
      .all(parentId) as BkCategoryRow[]
  }

  update(
    id: string,
    data: Partial<{
      name: string
      parentId: string | null
      taxCategory: string
    }>
  ): void {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.name !== undefined) {
      sets.push('name = ?')
      params.push(data.name)
    }
    if (data.parentId !== undefined) {
      sets.push('parent_id = ?')
      params.push(data.parentId)
    }
    if (data.taxCategory !== undefined) {
      sets.push('tax_category = ?')
      params.push(data.taxCategory)
    }

    if (sets.length === 0) return

    params.push(id)
    this.db.prepare(`UPDATE bk_categories SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  delete(id: string): void {
    // Move children to no parent
    this.db.prepare('UPDATE bk_categories SET parent_id = NULL WHERE parent_id = ?').run(id)
    this.db.prepare('DELETE FROM bk_categories WHERE id = ?').run(id)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM bk_categories').get() as {
      cnt: number
    }
    return row.cnt
  }
}
