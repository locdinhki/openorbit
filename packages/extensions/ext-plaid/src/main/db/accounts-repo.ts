import type Database from 'better-sqlite3'

export interface PlaidAccountRow {
  id: string
  item_id: string
  name: string
  official_name: string | null
  type: string
  subtype: string | null
  current_balance: number | null
  available_balance: number | null
  currency: string | null
  mask: string | null
  synced_at: string
}

export class PlaidAccountsRepo {
  constructor(private db: Database.Database) {}

  upsert(account: {
    id: string
    itemId: string
    name: string
    officialName?: string | null
    type: string
    subtype?: string | null
    currentBalance?: number | null
    availableBalance?: number | null
    currency?: string | null
    mask?: string | null
  }): void {
    this.db
      .prepare(
        `INSERT INTO plaid_accounts (id, item_id, name, official_name, type, subtype, current_balance, available_balance, currency, mask, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           official_name = excluded.official_name,
           type = excluded.type,
           subtype = excluded.subtype,
           current_balance = excluded.current_balance,
           available_balance = excluded.available_balance,
           currency = excluded.currency,
           mask = excluded.mask,
           synced_at = datetime('now')`
      )
      .run(
        account.id,
        account.itemId,
        account.name,
        account.officialName ?? null,
        account.type,
        account.subtype ?? null,
        account.currentBalance ?? null,
        account.availableBalance ?? null,
        account.currency ?? 'USD',
        account.mask ?? null
      )
  }

  getById(id: string): PlaidAccountRow | null {
    return (
      (this.db.prepare('SELECT * FROM plaid_accounts WHERE id = ?').get(id) as
        | PlaidAccountRow
        | undefined) ?? null
    )
  }

  listByItem(itemId: string): PlaidAccountRow[] {
    return this.db
      .prepare('SELECT * FROM plaid_accounts WHERE item_id = ? ORDER BY name')
      .all(itemId) as PlaidAccountRow[]
  }

  list(): PlaidAccountRow[] {
    return this.db.prepare('SELECT * FROM plaid_accounts ORDER BY name').all() as PlaidAccountRow[]
  }

  getTotalBalance(): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(current_balance), 0) as total FROM plaid_accounts')
      .get() as { total: number }
    return row.total
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM plaid_accounts WHERE id = ?').run(id)
  }

  deleteByItem(itemId: string): void {
    this.db.prepare('DELETE FROM plaid_accounts WHERE item_id = ?').run(itemId)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM plaid_accounts').get() as {
      cnt: number
    }
    return row.cnt
  }
}
