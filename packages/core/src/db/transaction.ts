import type Database from 'better-sqlite3'
import { getDatabase } from './database'

/**
 * Execute a function within a SQLite transaction.
 * Automatically commits on success, rolls back on error.
 */
export function withTransaction<T>(fn: (db: Database.Database) => T): T {
  const db = getDatabase()
  const wrapped = db.transaction(fn)
  return wrapped(db)
}
