import type Database from 'better-sqlite3'

export interface PlaidItemRow {
  id: string
  access_token: string
  institution_id: string | null
  institution_name: string | null
  status: string
  error_code: string | null
  error_message: string | null
  created_at: string
  synced_at: string
}

export class PlaidItemsRepo {
  constructor(private db: Database.Database) {}

  insert(item: {
    id: string
    accessToken: string
    institutionId?: string
    institutionName?: string
  }): void {
    this.db
      .prepare(
        `INSERT INTO plaid_items (id, access_token, institution_id, institution_name, synced_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      )
      .run(item.id, item.accessToken, item.institutionId ?? null, item.institutionName ?? null)
  }

  getById(id: string): PlaidItemRow | null {
    return (
      (this.db.prepare('SELECT * FROM plaid_items WHERE id = ?').get(id) as
        | PlaidItemRow
        | undefined) ?? null
    )
  }

  getByAccessToken(accessToken: string): PlaidItemRow | null {
    return (
      (this.db.prepare('SELECT * FROM plaid_items WHERE access_token = ?').get(accessToken) as
        | PlaidItemRow
        | undefined) ?? null
    )
  }

  list(): PlaidItemRow[] {
    return this.db
      .prepare('SELECT * FROM plaid_items ORDER BY created_at DESC')
      .all() as PlaidItemRow[]
  }

  listActive(): PlaidItemRow[] {
    return this.db
      .prepare("SELECT * FROM plaid_items WHERE status = 'active' ORDER BY created_at DESC")
      .all() as PlaidItemRow[]
  }

  updateStatus(id: string, status: string, errorCode?: string, errorMessage?: string): void {
    this.db
      .prepare(
        "UPDATE plaid_items SET status = ?, error_code = ?, error_message = ?, synced_at = datetime('now') WHERE id = ?"
      )
      .run(status, errorCode ?? null, errorMessage ?? null, id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM plaid_items WHERE id = ?').run(id)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM plaid_items').get() as {
      cnt: number
    }
    return row.cnt
  }
}
