import Database from 'better-sqlite3'

// Inline the migration SQL to avoid importing from the mocked database module.
// This must be kept in sync with MIGRATION_V1_SQL in src/main/db/database.ts.
const TEST_MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS search_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    platform TEXT NOT NULL,
    search_config TEXT NOT NULL,
    application_config TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    external_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    profile_id TEXT NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    salary TEXT,
    job_type TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    posted_date TEXT NOT NULL DEFAULT '',
    easy_apply INTEGER NOT NULL DEFAULT 0,
    match_score INTEGER,
    match_reasoning TEXT,
    summary TEXT,
    red_flags TEXT,
    highlights TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    user_notes TEXT,
    reviewed_at TEXT,
    applied_at TEXT,
    application_answers TEXT,
    cover_letter_used TEXT,
    resume_used TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(external_id, platform)
  );

  CREATE TABLE IF NOT EXISTS action_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    site TEXT NOT NULL,
    url TEXT NOT NULL,
    intent TEXT NOT NULL,
    page_snapshot TEXT NOT NULL DEFAULT '',
    hint_used TEXT NOT NULL DEFAULT '{}',
    execution_method TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_target TEXT NOT NULL,
    action_value TEXT,
    success INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    corrected_target TEXT,
    corrected_value TEXT
  );

  CREATE TABLE IF NOT EXISTS answer_templates (
    id TEXT PRIMARY KEY,
    question_pattern TEXT NOT NULL,
    answer TEXT NOT NULL,
    platform TEXT,
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_profile_id ON jobs(profile_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_external_id ON jobs(external_id, platform);
  CREATE INDEX IF NOT EXISTS idx_jobs_match_score ON jobs(match_score);
  CREATE INDEX IF NOT EXISTS idx_action_logs_site ON action_logs(site);
  CREATE INDEX IF NOT EXISTS idx_action_logs_timestamp ON action_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_answer_templates_pattern ON answer_templates(question_pattern);
`

// Keep in sync with MIGRATION_V2_SQL in src/main/db/database.ts.
const TEST_MIGRATION_V2_SQL = `
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

// Keep in sync with MIGRATION_V3_SQL in src/main/db/database.ts.
const TEST_MIGRATION_V3_SQL = `
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

// Keep in sync with MIGRATION_V4_SQL in src/main/db/database.ts.
const TEST_MIGRATION_V4_SQL = `
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

export function createTestDatabase(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Run migration v1
  db.exec(TEST_MIGRATION_SQL)
  db.prepare('INSERT INTO _migrations (version, description) VALUES (?, ?)').run(
    1,
    'Initial schema'
  )

  // Run migration v2
  db.exec(TEST_MIGRATION_V2_SQL)
  db.prepare('INSERT INTO _migrations (version, description) VALUES (?, ?)').run(
    2,
    'API usage tracking'
  )

  // Run migration v3
  db.exec(TEST_MIGRATION_V3_SQL)
  db.prepare('INSERT INTO _migrations (version, description) VALUES (?, ?)').run(3, 'Memory system')

  // Run migration v4
  db.exec(TEST_MIGRATION_V4_SQL)
  db.prepare('INSERT INTO _migrations (version, description) VALUES (?, ?)').run(
    4,
    'Cron scheduling'
  )

  return db
}
