import type { ExtensionMigration } from '@openorbit/core/extensions/types'

export const extPlaidMigrations: ExtensionMigration[] = [
  {
    version: 1,
    description: 'Create Plaid items, accounts, transactions, and sync cursor tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS plaid_items (
          id               TEXT PRIMARY KEY,
          access_token     TEXT NOT NULL,
          institution_id   TEXT,
          institution_name TEXT,
          status           TEXT NOT NULL DEFAULT 'active',
          error_code       TEXT,
          error_message    TEXT,
          created_at       TEXT NOT NULL DEFAULT (datetime('now')),
          synced_at        TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS plaid_accounts (
          id                TEXT PRIMARY KEY,
          item_id           TEXT NOT NULL,
          name              TEXT NOT NULL,
          official_name     TEXT,
          type              TEXT NOT NULL,
          subtype           TEXT,
          current_balance   REAL,
          available_balance REAL,
          currency          TEXT DEFAULT 'USD',
          mask              TEXT,
          synced_at         TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (item_id) REFERENCES plaid_items(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS plaid_transactions (
          id              TEXT PRIMARY KEY,
          account_id      TEXT NOT NULL,
          amount          REAL NOT NULL,
          date            TEXT NOT NULL,
          name            TEXT NOT NULL,
          merchant_name   TEXT,
          category        TEXT,
          category_id     TEXT,
          pending         INTEGER NOT NULL DEFAULT 0,
          bookkeeping_id  TEXT,
          raw             TEXT NOT NULL DEFAULT '{}',
          synced_at       TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (account_id) REFERENCES plaid_accounts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS plaid_sync_cursors (
          item_id    TEXT PRIMARY KEY,
          cursor     TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (item_id) REFERENCES plaid_items(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item ON plaid_accounts(item_id);
        CREATE INDEX IF NOT EXISTS idx_plaid_txns_account ON plaid_transactions(account_id);
        CREATE INDEX IF NOT EXISTS idx_plaid_txns_date ON plaid_transactions(date);
        CREATE INDEX IF NOT EXISTS idx_plaid_txns_bookkeeping ON plaid_transactions(bookkeeping_id);
      `)
    }
  }
]
