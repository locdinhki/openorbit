import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface BkAccountRow {
  id: string
  name: string
  type: string
  subtype: string | null
  plaid_account_id: string | null
  opening_balance: number
  current_balance: number
  created_at: string
  updated_at: string
}

export interface CreateAccountInput {
  name: string
  type: string
  subtype?: string
  openingBalance?: number
}

export class BkAccountsRepo {
  constructor(private db: Database.Database) {}

  create(input: CreateAccountInput): BkAccountRow {
    const id = randomUUID()
    const openingBalance = input.openingBalance ?? 0

    this.db
      .prepare(
        `INSERT INTO bk_accounts (id, name, type, subtype, opening_balance, current_balance)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.name, input.type, input.subtype ?? null, openingBalance, openingBalance)

    return this.getById(id)!
  }

  getById(id: string): BkAccountRow | null {
    return (
      (this.db.prepare('SELECT * FROM bk_accounts WHERE id = ?').get(id) as
        | BkAccountRow
        | undefined) ?? null
    )
  }

  getByPlaidAccountId(plaidAccountId: string): BkAccountRow | null {
    return (
      (this.db
        .prepare('SELECT * FROM bk_accounts WHERE plaid_account_id = ?')
        .get(plaidAccountId) as BkAccountRow | undefined) ?? null
    )
  }

  list(): BkAccountRow[] {
    return this.db.prepare('SELECT * FROM bk_accounts ORDER BY name ASC').all() as BkAccountRow[]
  }

  update(
    id: string,
    data: Partial<{
      name: string
      openingBalance: number
    }>
  ): void {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.name !== undefined) {
      sets.push('name = ?')
      params.push(data.name)
    }
    if (data.openingBalance !== undefined) {
      sets.push('opening_balance = ?')
      params.push(data.openingBalance)
    }

    if (sets.length === 0) return

    sets.push("updated_at = datetime('now')")
    params.push(id)

    this.db.prepare(`UPDATE bk_accounts SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  linkToPlaid(id: string, plaidAccountId: string): void {
    this.db
      .prepare(
        `UPDATE bk_accounts SET plaid_account_id = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(plaidAccountId, id)
  }

  updateBalance(id: string, balance: number): void {
    this.db
      .prepare(
        `UPDATE bk_accounts SET current_balance = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(balance, id)
  }

  recalculateBalance(id: string): void {
    const account = this.getById(id)
    if (!account) return

    const row = this.db
      .prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM bk_transactions WHERE account_id = ?`)
      .get(id) as { total: number }

    const newBalance = account.opening_balance + row.total
    this.updateBalance(id, newBalance)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM bk_accounts WHERE id = ?').run(id)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM bk_accounts').get() as { cnt: number }
    return row.cnt
  }
}
