import type Database from 'better-sqlite3'

export interface PlaidTransactionRow {
  id: string
  account_id: string
  amount: number
  date: string
  name: string
  merchant_name: string | null
  category: string | null
  category_id: string | null
  pending: number
  bookkeeping_id: string | null
  raw: string
  synced_at: string
}

export class PlaidTransactionsRepo {
  constructor(private db: Database.Database) {}

  upsert(txn: {
    id: string
    accountId: string
    amount: number
    date: string
    name: string
    merchantName?: string | null
    category?: string[] | null
    categoryId?: string | null
    pending?: boolean
    raw?: unknown
  }): void {
    this.db
      .prepare(
        `INSERT INTO plaid_transactions (id, account_id, amount, date, name, merchant_name, category, category_id, pending, raw, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           amount = excluded.amount,
           date = excluded.date,
           name = excluded.name,
           merchant_name = excluded.merchant_name,
           category = excluded.category,
           category_id = excluded.category_id,
           pending = excluded.pending,
           raw = excluded.raw,
           synced_at = datetime('now')`
      )
      .run(
        txn.id,
        txn.accountId,
        txn.amount,
        txn.date,
        txn.name,
        txn.merchantName ?? null,
        txn.category ? JSON.stringify(txn.category) : null,
        txn.categoryId ?? null,
        txn.pending ? 1 : 0,
        JSON.stringify(txn.raw ?? {})
      )
  }

  getById(id: string): PlaidTransactionRow | null {
    return (
      (this.db.prepare('SELECT * FROM plaid_transactions WHERE id = ?').get(id) as
        | PlaidTransactionRow
        | undefined) ?? null
    )
  }

  listByAccount(accountId: string, limit = 100): PlaidTransactionRow[] {
    return this.db
      .prepare(
        'SELECT * FROM plaid_transactions WHERE account_id = ? ORDER BY date DESC, id DESC LIMIT ?'
      )
      .all(accountId, limit) as PlaidTransactionRow[]
  }

  list(opts?: {
    accountId?: string
    startDate?: string
    endDate?: string
    limit?: number
    offset?: number
  }): PlaidTransactionRow[] {
    const limit = opts?.limit ?? 100
    const offset = opts?.offset ?? 0

    let sql = 'SELECT * FROM plaid_transactions WHERE 1=1'
    const params: unknown[] = []

    if (opts?.accountId) {
      sql += ' AND account_id = ?'
      params.push(opts.accountId)
    }
    if (opts?.startDate) {
      sql += ' AND date >= ?'
      params.push(opts.startDate)
    }
    if (opts?.endDate) {
      sql += ' AND date <= ?'
      params.push(opts.endDate)
    }

    sql += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    return this.db.prepare(sql).all(...params) as PlaidTransactionRow[]
  }

  listUnlinked(limit = 100): PlaidTransactionRow[] {
    return this.db
      .prepare(
        'SELECT * FROM plaid_transactions WHERE bookkeeping_id IS NULL ORDER BY date DESC LIMIT ?'
      )
      .all(limit) as PlaidTransactionRow[]
  }

  linkToBookkeeping(txnId: string, bookkeepingId: string): void {
    this.db
      .prepare('UPDATE plaid_transactions SET bookkeeping_id = ? WHERE id = ?')
      .run(bookkeepingId, txnId)
  }

  deleteByAccount(accountId: string): void {
    this.db.prepare('DELETE FROM plaid_transactions WHERE account_id = ?').run(accountId)
  }

  removeDeleted(ids: string[]): void {
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(',')
    this.db.prepare(`DELETE FROM plaid_transactions WHERE id IN (${placeholders})`).run(...ids)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM plaid_transactions').get() as {
      cnt: number
    }
    return row.cnt
  }

  sumByDateRange(accountId: string, startDate: string, endDate: string): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM plaid_transactions
         WHERE account_id = ? AND date >= ? AND date <= ?`
      )
      .get(accountId, startDate, endDate) as { total: number }
    return row.total
  }
}
