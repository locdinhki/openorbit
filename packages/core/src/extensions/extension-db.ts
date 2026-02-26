// ============================================================================
// OpenOrbit — Extension Database Migration Runner
// ============================================================================

import type Database from 'better-sqlite3'
import type { ExtensionMigration } from './types'
import { createLogger } from '../utils/logger'

const log = createLogger('ExtensionDB')

const EXT_MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _ext_migrations (
    extension_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (extension_id, version)
  )
`

/**
 * Ensure the extension migrations tracking table exists.
 * Called once during shell startup before any extensions are loaded.
 */
export function ensureExtMigrationsTable(db: Database.Database): void {
  db.exec(EXT_MIGRATIONS_TABLE_SQL)
}

/**
 * Run pending migrations for a specific extension.
 *
 * Each extension maintains its own migration version track in the
 * `_ext_migrations` table, independent of core migrations and other extensions.
 */
export function runExtensionMigrations(
  db: Database.Database,
  extensionId: string,
  migrations: ExtensionMigration[]
): void {
  if (migrations.length === 0) return

  ensureExtMigrationsTable(db)

  const applied = db
    .prepare(
      'SELECT version FROM _ext_migrations WHERE extension_id = ? ORDER BY version DESC LIMIT 1'
    )
    .get(extensionId) as { version: number } | undefined

  const currentVersion = applied?.version ?? 0
  const pending = migrations
    .filter((m) => m.version > currentVersion)
    .sort((a, b) => a.version - b.version)

  if (pending.length === 0) {
    log.debug(`Extension "${extensionId}": no pending migrations (at v${currentVersion})`)
    return
  }

  log.info(
    `Extension "${extensionId}": running ${pending.length} migration(s) (v${currentVersion} → v${pending[pending.length - 1].version})`
  )

  const applyAll = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db)
      db.prepare(
        'INSERT INTO _ext_migrations (extension_id, version, description) VALUES (?, ?, ?)'
      ).run(extensionId, migration.version, migration.description)
      log.info(
        `Extension "${extensionId}": applied migration v${migration.version} — ${migration.description}`
      )
    }
  })

  applyAll()
}
