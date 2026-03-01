import type Database from 'better-sqlite3'

export interface PlaidSyncCursorRow {
  item_id: string
  cursor: string
  updated_at: string
}

export class PlaidSyncCursorsRepo {
  constructor(private db: Database.Database) {}

  get(itemId: string): string | null {
    const row = this.db
      .prepare('SELECT cursor FROM plaid_sync_cursors WHERE item_id = ?')
      .get(itemId) as { cursor: string } | undefined
    return row?.cursor ?? null
  }

  set(itemId: string, cursor: string): void {
    this.db
      .prepare(
        `INSERT INTO plaid_sync_cursors (item_id, cursor, updated_at)
         VALUES (?, ?, datetime('now'))
         ON CONFLICT(item_id) DO UPDATE SET
           cursor = excluded.cursor,
           updated_at = datetime('now')`
      )
      .run(itemId, cursor)
  }

  delete(itemId: string): void {
    this.db.prepare('DELETE FROM plaid_sync_cursors WHERE item_id = ?').run(itemId)
  }
}
