// ============================================================================
// ext-voip — Database Migrations
// ============================================================================

import type { ExtensionMigration } from '@openorbit/core/extensions/types'

export const extVoipMigrations: ExtensionMigration[] = [
  {
    version: 1,
    description: 'Create voip_calls and voip_recordings tables',
    up: (db) => {
      db.exec(`
        -- Call logs table
        CREATE TABLE IF NOT EXISTS voip_calls (
          id TEXT PRIMARY KEY,
          twilio_sid TEXT UNIQUE,
          from_number TEXT NOT NULL,
          to_number TEXT NOT NULL,
          contact_id TEXT,
          contact_name TEXT,
          direction TEXT NOT NULL CHECK(direction IN ('outbound', 'inbound')),
          status TEXT NOT NULL CHECK(status IN ('initiated', 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer', 'canceled')),
          duration_seconds INTEGER DEFAULT 0,
          start_time TEXT NOT NULL,
          end_time TEXT,
          answered_at TEXT,
          price TEXT,
          price_unit TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_voip_calls_twilio_sid ON voip_calls(twilio_sid);
        CREATE INDEX IF NOT EXISTS idx_voip_calls_contact_id ON voip_calls(contact_id);
        CREATE INDEX IF NOT EXISTS idx_voip_calls_status ON voip_calls(status);
        CREATE INDEX IF NOT EXISTS idx_voip_calls_start_time ON voip_calls(start_time);

        -- Call recordings table
        CREATE TABLE IF NOT EXISTS voip_recordings (
          id TEXT PRIMARY KEY,
          call_id TEXT NOT NULL REFERENCES voip_calls(id) ON DELETE CASCADE,
          twilio_sid TEXT UNIQUE,
          recording_url TEXT,
          duration_seconds INTEGER DEFAULT 0,
          file_size_bytes INTEGER,
          status TEXT NOT NULL CHECK(status IN ('recording', 'completed', 'failed', 'deleted')),
          transcript TEXT,
          transcript_status TEXT CHECK(transcript_status IN ('pending', 'processing', 'completed', 'failed')),
          transcript_model TEXT,
          transcript_duration_ms INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_voip_recordings_call_id ON voip_recordings(call_id);
        CREATE INDEX IF NOT EXISTS idx_voip_recordings_twilio_sid ON voip_recordings(twilio_sid);
        CREATE INDEX IF NOT EXISTS idx_voip_recordings_status ON voip_recordings(status);
      `)
    }
  },
  {
    version: 2,
    description: 'Add call notes and tags',
    up: (db) => {
      db.exec(`
        ALTER TABLE voip_calls ADD COLUMN notes TEXT;
        ALTER TABLE voip_calls ADD COLUMN tags TEXT;
        ALTER TABLE voip_calls ADD COLUMN outcome TEXT CHECK(outcome IN ('answered', 'voicemail', 'callback-requested', 'not-interested', 'sale', 'follow-up', 'other'));
      `)
    }
  }
]
