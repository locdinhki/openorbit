import type { ExtensionMigration } from '@openorbit/core/extensions/types'

export const extStripeMigrations: ExtensionMigration[] = [
  {
    version: 1,
    description: 'Create Stripe customers, payments, subscriptions, and payment links tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS stripe_customers (
          id              TEXT PRIMARY KEY,
          email           TEXT,
          name            TEXT,
          phone           TEXT,
          ghl_contact_id  TEXT,
          metadata        TEXT NOT NULL DEFAULT '{}',
          raw             TEXT NOT NULL DEFAULT '{}',
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          synced_at       TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS stripe_payments (
          id              TEXT PRIMARY KEY,
          customer_id     TEXT,
          amount          INTEGER NOT NULL,
          currency        TEXT NOT NULL DEFAULT 'usd',
          status          TEXT NOT NULL,
          payment_method  TEXT,
          invoice_id      TEXT,
          description     TEXT,
          metadata        TEXT NOT NULL DEFAULT '{}',
          raw             TEXT NOT NULL DEFAULT '{}',
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          synced_at       TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS stripe_subscriptions (
          id                    TEXT PRIMARY KEY,
          customer_id           TEXT NOT NULL,
          status                TEXT NOT NULL,
          current_period_start  TEXT,
          current_period_end    TEXT,
          items                 TEXT NOT NULL DEFAULT '[]',
          cancel_at_period_end  INTEGER NOT NULL DEFAULT 0,
          metadata              TEXT NOT NULL DEFAULT '{}',
          raw                   TEXT NOT NULL DEFAULT '{}',
          created_at            TEXT NOT NULL DEFAULT (datetime('now')),
          synced_at             TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS stripe_payment_links (
          id          TEXT PRIMARY KEY,
          url         TEXT NOT NULL,
          active      INTEGER NOT NULL DEFAULT 1,
          amount      INTEGER NOT NULL,
          currency    TEXT NOT NULL DEFAULT 'usd',
          description TEXT,
          metadata    TEXT NOT NULL DEFAULT '{}',
          created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_stripe_customers_email ON stripe_customers(email);
        CREATE INDEX IF NOT EXISTS idx_stripe_payments_customer ON stripe_payments(customer_id);
        CREATE INDEX IF NOT EXISTS idx_stripe_payments_status ON stripe_payments(status);
        CREATE INDEX IF NOT EXISTS idx_stripe_subs_customer ON stripe_subscriptions(customer_id);
        CREATE INDEX IF NOT EXISTS idx_stripe_subs_status ON stripe_subscriptions(status);
      `)
    }
  }
]
