import type Database from 'better-sqlite3'

/**
 * Execute a function within a SQLite transaction.
 * Automatically commits on success, rolls back on error.
 */
export function withTransaction<T>(db: Database.Database, fn: (db: Database.Database) => T): T {
  const wrapped = db.transaction(fn)
  return wrapped(db)
}
