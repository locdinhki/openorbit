import type { ExtensionMigration } from '@openorbit/core/extensions/types'

export const extInvoicingMigrations: ExtensionMigration[] = [
  {
    version: 1,
    description: 'Create invoices, invoice items, payments, templates, and recurring tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS invoices (
          id                    TEXT PRIMARY KEY,
          invoice_number        TEXT NOT NULL UNIQUE,
          status                TEXT NOT NULL DEFAULT 'draft',
          customer_name         TEXT NOT NULL,
          customer_email        TEXT NOT NULL,
          customer_address      TEXT,
          customer_phone        TEXT,
          subtotal              REAL NOT NULL DEFAULT 0,
          tax_rate              REAL NOT NULL DEFAULT 0,
          tax_amount            REAL NOT NULL DEFAULT 0,
          total                 REAL NOT NULL DEFAULT 0,
          amount_paid           REAL NOT NULL DEFAULT 0,
          due_date              TEXT,
          sent_at               TEXT,
          paid_at               TEXT,
          voided_at             TEXT,
          void_reason           TEXT,
          notes                 TEXT,
          template_id           TEXT,
          stripe_payment_link_id  TEXT,
          stripe_payment_link_url TEXT,
          created_at            TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS invoice_items (
          id          TEXT PRIMARY KEY,
          invoice_id  TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity    REAL NOT NULL DEFAULT 1,
          unit_price  REAL NOT NULL DEFAULT 0,
          amount      REAL NOT NULL DEFAULT 0,
          sort_order  INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS invoice_payments (
          id              TEXT PRIMARY KEY,
          invoice_id      TEXT NOT NULL,
          amount          REAL NOT NULL,
          payment_date    TEXT NOT NULL DEFAULT (date('now')),
          payment_method  TEXT NOT NULL DEFAULT 'other',
          stripe_payment_id TEXT,
          notes           TEXT,
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS invoice_templates (
          id            TEXT PRIMARY KEY,
          name          TEXT NOT NULL,
          logo_url      TEXT,
          primary_color TEXT DEFAULT '#4F46E5',
          header_text   TEXT,
          footer_text   TEXT,
          is_default    INTEGER NOT NULL DEFAULT 0,
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS invoice_recurring (
          id              TEXT PRIMARY KEY,
          customer_name   TEXT NOT NULL,
          customer_email  TEXT NOT NULL,
          customer_address TEXT,
          customer_phone  TEXT,
          items           TEXT NOT NULL DEFAULT '[]',
          frequency       TEXT NOT NULL DEFAULT 'monthly',
          next_date       TEXT NOT NULL,
          last_generated  TEXT,
          auto_send       INTEGER NOT NULL DEFAULT 1,
          paused          INTEGER NOT NULL DEFAULT 0,
          created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
        CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
        CREATE INDEX IF NOT EXISTS idx_invoices_customer_email ON invoices(customer_email);
        CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_invoice_recurring_next ON invoice_recurring(next_date);
      `)
    }
  }
]
