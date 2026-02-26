import type { ExtensionMigration } from '@openorbit/core/extensions/types'

export const extGhlMigrations: ExtensionMigration[] = [
  {
    version: 1,
    description: 'Create GHL contacts, opportunities, and pipelines tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ghl_contacts (
          id           TEXT PRIMARY KEY,
          location_id  TEXT NOT NULL,
          first_name   TEXT,
          last_name    TEXT,
          name         TEXT,
          email        TEXT,
          phone        TEXT,
          company_name TEXT,
          address1     TEXT,
          city         TEXT,
          state        TEXT,
          postal_code  TEXT,
          tags         TEXT NOT NULL DEFAULT '[]',
          custom_fields TEXT NOT NULL DEFAULT '[]',
          raw          TEXT NOT NULL DEFAULT '{}',
          synced_at    TEXT NOT NULL DEFAULT (datetime('now')),
          created_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ghl_opportunities (
          id                TEXT PRIMARY KEY,
          location_id       TEXT NOT NULL,
          name              TEXT NOT NULL,
          monetary_value    REAL,
          pipeline_id       TEXT NOT NULL,
          pipeline_stage_id TEXT NOT NULL,
          status            TEXT NOT NULL DEFAULT 'open',
          contact_id        TEXT NOT NULL,
          assigned_to       TEXT,
          custom_fields     TEXT NOT NULL DEFAULT '[]',
          raw               TEXT NOT NULL DEFAULT '{}',
          synced_at         TEXT NOT NULL DEFAULT (datetime('now')),
          created_at        TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ghl_pipelines (
          id          TEXT PRIMARY KEY,
          location_id TEXT NOT NULL,
          name        TEXT NOT NULL,
          stages      TEXT NOT NULL DEFAULT '[]',
          synced_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_ghl_contacts_location ON ghl_contacts(location_id);
        CREATE INDEX IF NOT EXISTS idx_ghl_contacts_email    ON ghl_contacts(email);
        CREATE INDEX IF NOT EXISTS idx_ghl_opps_pipeline     ON ghl_opportunities(pipeline_id);
        CREATE INDEX IF NOT EXISTS idx_ghl_opps_contact      ON ghl_opportunities(contact_id);
        CREATE INDEX IF NOT EXISTS idx_ghl_opps_status       ON ghl_opportunities(status);
      `)
    }
  },
  {
    version: 2,
    description: 'Create ARV enrichment runs table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ghl_arv_runs (
          id             TEXT PRIMARY KEY,
          pipeline_id    TEXT NOT NULL,
          pipeline_name  TEXT NOT NULL,
          total          INTEGER NOT NULL DEFAULT 0,
          enriched       INTEGER NOT NULL DEFAULT 0,
          skipped        INTEGER NOT NULL DEFAULT 0,
          errors         INTEGER NOT NULL DEFAULT 0,
          status         TEXT NOT NULL DEFAULT 'running',
          started_at     TEXT NOT NULL DEFAULT (datetime('now')),
          finished_at    TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_ghl_arv_runs_status ON ghl_arv_runs(status);
      `)
    }
  }
]
