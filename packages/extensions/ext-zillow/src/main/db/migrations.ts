import type { ExtensionMigration } from '@openorbit/core/extensions/types'

export const extZillowMigrations: ExtensionMigration[] = [
  {
    version: 1,
    description: 'Create ARV cache table',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS arv_cache (
          id            TEXT PRIMARY KEY,
          address1      TEXT NOT NULL,
          city          TEXT NOT NULL,
          state         TEXT NOT NULL,
          postal_code   TEXT NOT NULL,
          zestimate     INTEGER,
          zillow_url    TEXT,
          error         TEXT,
          scraped_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_arv_cache_address
          ON arv_cache(address1, city, state, postal_code);
      `)
    }
  }
]
