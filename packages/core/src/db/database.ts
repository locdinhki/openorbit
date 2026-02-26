import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import { join } from 'path'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { DB_FILENAME } from '../constants'
import { getCoreConfig } from '../config'
import { createLogger } from '../utils/logger'

const log = createLogger('Database')

let db: Database.Database | null = null

function getDbPath(): string {
  const { dataDir } = getCoreConfig()
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  return join(dataDir, DB_FILENAME)
}

/** One-time migration: rename contractor-os.db → openorbit.db */
function migrateDbFilename(): void {
  const { dataDir } = getCoreConfig()
  const oldPath = join(dataDir, 'contractor-os.db')
  const newPath = join(dataDir, DB_FILENAME)
  if (existsSync(oldPath) && !existsSync(newPath)) {
    renameSync(oldPath, newPath)
    // Also rename WAL/SHM sidecar files if they exist
    for (const ext of ['-wal', '-shm']) {
      if (existsSync(oldPath + ext)) {
        renameSync(oldPath + ext, newPath + ext)
      }
    }
    log.info('Migrated database file from contractor-os.db to openorbit.db')
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    migrateDbFilename()
    db = new Database(getDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    sqliteVec.load(db)
    runMigrations(db)
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

// --- Migration System ---

interface Migration {
  version: number
  description: string
  up: (db: Database.Database) => void
}

export const MIGRATION_V1_SQL = `
  CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`

const MIGRATIONS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`

export const MIGRATION_V2_SQL = `
  CREATE TABLE IF NOT EXISTS api_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_key_hash TEXT NOT NULL,
    model TEXT NOT NULL,
    task TEXT NOT NULL,
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    success INTEGER NOT NULL DEFAULT 1,
    error_code TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage(api_key_hash);
  CREATE INDEX IF NOT EXISTS idx_api_usage_created ON api_usage(created_at);
`

export const MIGRATION_V3_SQL = `
  CREATE TABLE IF NOT EXISTS memory_facts (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL CHECK(category IN ('preference','company','pattern','answer')),
    content TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'user',
    confidence REAL NOT NULL DEFAULT 1.0,
    metadata TEXT NOT NULL DEFAULT '{}',
    embedding BLOB,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    accessed_at TEXT NOT NULL DEFAULT (datetime('now')),
    access_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_memory_category ON memory_facts(category);
  CREATE INDEX IF NOT EXISTS idx_memory_accessed ON memory_facts(accessed_at);

  CREATE VIRTUAL TABLE IF NOT EXISTS memory_facts_fts USING fts5(
    content, category, metadata,
    content='memory_facts', content_rowid='rowid'
  );

  CREATE TRIGGER IF NOT EXISTS memory_facts_ai AFTER INSERT ON memory_facts BEGIN
    INSERT INTO memory_facts_fts(rowid, content, category, metadata)
    VALUES (new.rowid, new.content, new.category, new.metadata);
  END;

  CREATE TRIGGER IF NOT EXISTS memory_facts_ad AFTER DELETE ON memory_facts BEGIN
    INSERT INTO memory_facts_fts(memory_facts_fts, rowid, content, category, metadata)
    VALUES ('delete', old.rowid, old.content, old.category, old.metadata);
  END;

  CREATE TRIGGER IF NOT EXISTS memory_facts_au AFTER UPDATE ON memory_facts BEGIN
    INSERT INTO memory_facts_fts(memory_facts_fts, rowid, content, category, metadata)
    VALUES ('delete', old.rowid, old.content, old.category, old.metadata);
    INSERT INTO memory_facts_fts(rowid, content, category, metadata)
    VALUES (new.rowid, new.content, new.category, new.metadata);
  END;
`

export const MIGRATION_V4_SQL = `
  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK(task_type IN ('extraction','hint_verification','db_backup','log_rotation','daily_summary')),
    cron_expression TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    config TEXT NOT NULL DEFAULT '{}',
    last_run_at TEXT,
    last_run_status TEXT,
    last_run_error TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
`

export const MIGRATION_V5_SQL = `
  CREATE TABLE IF NOT EXISTS _ext_migrations (
    extension_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    description TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (extension_id, version)
  );
`

export const MIGRATION_V6_SQL = `
  -- Recreate schedules table without CHECK constraint on task_type
  -- (extensions can register arbitrary task types at runtime)
  CREATE TABLE IF NOT EXISTS schedules_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    task_type TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    config TEXT NOT NULL DEFAULT '{}',
    last_run_at TEXT,
    last_run_status TEXT,
    last_run_error TEXT,
    next_run_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO schedules_new SELECT * FROM schedules;
  DROP TABLE IF EXISTS schedules;
  ALTER TABLE schedules_new RENAME TO schedules;

  CREATE INDEX IF NOT EXISTS idx_schedules_enabled ON schedules(enabled);
`

export const MIGRATION_V7_SQL = `
  CREATE TABLE IF NOT EXISTS schedule_runs (
    id            TEXT PRIMARY KEY,
    schedule_id   TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    status        TEXT NOT NULL CHECK(status IN ('success', 'error', 'running')),
    error_message TEXT,
    duration_ms   INTEGER,
    started_at    TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at  TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule ON schedule_runs(schedule_id);
  CREATE INDEX IF NOT EXISTS idx_schedule_runs_started  ON schedule_runs(started_at DESC);
`

const migrations: Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    up: (db) => {
      db.exec(MIGRATION_V1_SQL)
    }
  },
  {
    version: 2,
    description: 'API usage tracking',
    up: (db) => {
      db.exec(MIGRATION_V2_SQL)
    }
  },
  {
    version: 3,
    description: 'Memory system',
    up: (db) => {
      db.exec(MIGRATION_V3_SQL)
    }
  },
  {
    version: 4,
    description: 'Cron scheduling',
    up: (db) => {
      db.exec(MIGRATION_V4_SQL)
    }
  },
  {
    version: 5,
    description: 'Extension migrations tracking',
    up: (db) => {
      db.exec(MIGRATION_V5_SQL)
    }
  },
  {
    version: 6,
    description: 'Relax schedules task_type constraint',
    up: (db) => {
      db.exec(MIGRATION_V6_SQL)
    }
  },
  {
    version: 7,
    description: 'Schedule run history',
    up: (db) => {
      db.exec(MIGRATION_V7_SQL)
    }
  }
]

function runMigrations(db: Database.Database): void {
  db.exec(MIGRATIONS_TABLE_SQL)

  const applied = db
    .prepare('SELECT version FROM _migrations ORDER BY version DESC LIMIT 1')
    .get() as { version: number } | undefined

  const currentVersion = applied?.version ?? 0

  const pending = migrations.filter((m) => m.version > currentVersion)
  if (pending.length === 0) return

  const applyMigration = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db)
      db.prepare('INSERT INTO _migrations (version, description) VALUES (?, ?)').run(
        migration.version,
        migration.description
      )
    }
  })

  applyMigration()
  validateSchema(db)
}

// --- Schema Validation ---

const EXPECTED_TABLES = [
  'user_profile',
  'settings',
  'api_usage',
  'memory_facts',
  'schedules',
  'schedule_runs',
  '_migrations',
  '_ext_migrations'
]

function validateSchema(db: Database.Database): void {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[]

  const tableNames = new Set(tables.map((t) => t.name))

  for (const expected of EXPECTED_TABLES) {
    if (!tableNames.has(expected)) {
      log.warn(`Schema drift: missing expected table '${expected}'`)
    }
  }

  log.info('Schema validation complete', {
    tables: tableNames.size,
    expected: EXPECTED_TABLES.length
  })
}
