import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface BkTransactionRow {
  id: string
  date: string
  amount: number
  description: string
  payee: string | null
  category_id: string | null
  account_id: string
  source: string
  plaid_txn_id: string | null
  stripe_payment_id: string | null
  ai_suggested_category_id: string | null
  ai_confidence: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateTransactionInput {
  date: string
  amount: number
  description: string
  payee?: string
  categoryId?: string
  accountId: string
  source?: string
  plaidTxnId?: string
  stripePaymentId?: string
  notes?: string
}

export class BkTransactionsRepo {
  constructor(private db: Database.Database) {}

  create(input: CreateTransactionInput): BkTransactionRow {
    const id = randomUUID()

    this.db
      .prepare(
        `INSERT INTO bk_transactions (
          id, date, amount, description, payee, category_id, account_id,
          source, plaid_txn_id, stripe_payment_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.date,
        input.amount,
        input.description,
        input.payee ?? null,
        input.categoryId ?? null,
        input.accountId,
        input.source ?? 'manual',
        input.plaidTxnId ?? null,
        input.stripePaymentId ?? null,
        input.notes ?? null
      )

    return this.getById(id)!
  }

  getById(id: string): BkTransactionRow | null {
    return (
      (this.db.prepare('SELECT * FROM bk_transactions WHERE id = ?').get(id) as
        | BkTransactionRow
        | undefined) ?? null
    )
  }

  getByPlaidTxnId(plaidTxnId: string): BkTransactionRow | null {
    return (
      (this.db.prepare('SELECT * FROM bk_transactions WHERE plaid_txn_id = ?').get(plaidTxnId) as
        | BkTransactionRow
        | undefined) ?? null
    )
  }

  list(opts?: {
    accountId?: string
    categoryId?: string
    startDate?: string
    endDate?: string
    uncategorized?: boolean
    limit?: number
    offset?: number
  }): BkTransactionRow[] {
    const limit = opts?.limit ?? 100
    const offset = opts?.offset ?? 0

    let sql = 'SELECT * FROM bk_transactions WHERE 1=1'
    const params: unknown[] = []

    if (opts?.accountId) {
      sql += ' AND account_id = ?'
      params.push(opts.accountId)
    }
    if (opts?.categoryId) {
      sql += ' AND category_id = ?'
      params.push(opts.categoryId)
    }
    if (opts?.startDate) {
      sql += ' AND date >= ?'
      params.push(opts.startDate)
    }
    if (opts?.endDate) {
      sql += ' AND date <= ?'
      params.push(opts.endDate)
    }
    if (opts?.uncategorized) {
      sql += ' AND category_id IS NULL'
    }

    sql += ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    return this.db.prepare(sql).all(...params) as BkTransactionRow[]
  }

  listUncategorized(limit = 100): BkTransactionRow[] {
    return this.db
      .prepare('SELECT * FROM bk_transactions WHERE category_id IS NULL ORDER BY date DESC LIMIT ?')
      .all(limit) as BkTransactionRow[]
  }

  update(
    id: string,
    data: Partial<{
      date: string
      amount: number
      description: string
      payee: string
      categoryId: string | null
      notes: string
    }>
  ): void {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.date !== undefined) {
      sets.push('date = ?')
      params.push(data.date)
    }
    if (data.amount !== undefined) {
      sets.push('amount = ?')
      params.push(data.amount)
    }
    if (data.description !== undefined) {
      sets.push('description = ?')
      params.push(data.description)
    }
    if (data.payee !== undefined) {
      sets.push('payee = ?')
      params.push(data.payee)
    }
    if (data.categoryId !== undefined) {
      sets.push('category_id = ?')
      params.push(data.categoryId)
    }
    if (data.notes !== undefined) {
      sets.push('notes = ?')
      params.push(data.notes)
    }

    if (sets.length === 0) return

    sets.push("updated_at = datetime('now')")
    params.push(id)

    this.db.prepare(`UPDATE bk_transactions SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  updateCategory(id: string, categoryId: string | null): void {
    this.db
      .prepare(
        `UPDATE bk_transactions SET category_id = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(categoryId, id)
  }

  updateAiSuggestion(id: string, categoryId: string, confidence: number): void {
    this.db
      .prepare(
        `UPDATE bk_transactions SET
         ai_suggested_category_id = ?,
         ai_confidence = ?,
         updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(categoryId, confidence, id)
  }

  bulkUpdateCategory(ids: string[], categoryId: string): void {
    const placeholders = ids.map(() => '?').join(',')
    this.db
      .prepare(
        `UPDATE bk_transactions SET category_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
      )
      .run(categoryId, ...ids)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM bk_transactions WHERE id = ?').run(id)
  }

  sumByCategory(categoryId: string, startDate?: string, endDate?: string): number {
    let sql = 'SELECT COALESCE(SUM(amount), 0) as total FROM bk_transactions WHERE category_id = ?'
    const params: unknown[] = [categoryId]

    if (startDate) {
      sql += ' AND date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND date <= ?'
      params.push(endDate)
    }

    const row = this.db.prepare(sql).get(...params) as { total: number }
    return row.total
  }

  sumByCategoryType(type: 'income' | 'expense', startDate: string, endDate: string): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(t.amount), 0) as total
         FROM bk_transactions t
         JOIN bk_categories c ON t.category_id = c.id
         WHERE c.type = ? AND t.date >= ? AND t.date <= ?`
      )
      .get(type, startDate, endDate) as { total: number }
    return row.total
  }

  countUncategorized(): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM bk_transactions WHERE category_id IS NULL')
      .get() as { cnt: number }
    return row.cnt
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM bk_transactions').get() as {
      cnt: number
    }
    return row.cnt
  }
}
