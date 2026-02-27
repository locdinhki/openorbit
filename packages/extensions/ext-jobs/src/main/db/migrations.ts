import type { ExtensionMigration } from '@openorbit/core/extensions/types'

export const extJobsMigrations: ExtensionMigration[] = [
  {
    version: 1,
    description: 'Adopt job search tables',
    up: (db) => {
      db.exec(`
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

        CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        CREATE INDEX IF NOT EXISTS idx_jobs_profile_id ON jobs(profile_id);
        CREATE INDEX IF NOT EXISTS idx_jobs_external_id ON jobs(external_id, platform);
        CREATE INDEX IF NOT EXISTS idx_jobs_match_score ON jobs(match_score);
        CREATE INDEX IF NOT EXISTS idx_action_logs_site ON action_logs(site);
        CREATE INDEX IF NOT EXISTS idx_action_logs_timestamp ON action_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_answer_templates_pattern ON answer_templates(question_pattern);
      `)
    }
  },
  {
    version: 2,
    description: 'Add chat sessions and messages tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
          content TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);
        CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at DESC);
      `)
    }
  }
]
