import type { ExtensionMigration } from '@openorbit/core/extensions/types'

export const extBookkeepingMigrations: ExtensionMigration[] = [
  {
    version: 1,
    description:
      'Create bookkeeping accounts, categories, transactions, receipts, and rules tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS bk_accounts (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL,
          type            TEXT NOT NULL DEFAULT 'checking',
          subtype         TEXT,
          plaid_account_id TEXT,
          opening_balance REAL NOT NULL DEFAULT 0,
          current_balance REAL NOT NULL DEFAULT 0,
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS bk_categories (
          id           TEXT PRIMARY KEY,
          name         TEXT NOT NULL,
          type         TEXT NOT NULL CHECK (type IN ('income', 'expense')),
          parent_id    TEXT,
          tax_category TEXT,
          sort_order   INTEGER NOT NULL DEFAULT 0,
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (parent_id) REFERENCES bk_categories(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS bk_transactions (
          id                      TEXT PRIMARY KEY,
          date                    TEXT NOT NULL,
          amount                  REAL NOT NULL,
          description             TEXT NOT NULL,
          payee                   TEXT,
          category_id             TEXT,
          account_id              TEXT NOT NULL,
          source                  TEXT NOT NULL DEFAULT 'manual',
          plaid_txn_id            TEXT,
          stripe_payment_id       TEXT,
          ai_suggested_category_id TEXT,
          ai_confidence           REAL,
          notes                   TEXT,
          created_at              TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (category_id) REFERENCES bk_categories(id) ON DELETE SET NULL,
          FOREIGN KEY (account_id) REFERENCES bk_accounts(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS bk_receipts (
          id           TEXT PRIMARY KEY,
          transaction_id TEXT NOT NULL,
          file_path    TEXT NOT NULL,
          ocr_vendor   TEXT,
          ocr_amount   REAL,
          ocr_date     TEXT,
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (transaction_id) REFERENCES bk_transactions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS bk_category_rules (
          id          TEXT PRIMARY KEY,
          pattern     TEXT NOT NULL,
          match_field TEXT NOT NULL DEFAULT 'description',
          category_id TEXT NOT NULL,
          created_at  TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (category_id) REFERENCES bk_categories(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_bk_txns_account ON bk_transactions(account_id);
        CREATE INDEX IF NOT EXISTS idx_bk_txns_category ON bk_transactions(category_id);
        CREATE INDEX IF NOT EXISTS idx_bk_txns_date ON bk_transactions(date);
        CREATE INDEX IF NOT EXISTS idx_bk_txns_plaid ON bk_transactions(plaid_txn_id);
        CREATE INDEX IF NOT EXISTS idx_bk_categories_parent ON bk_categories(parent_id);
        CREATE INDEX IF NOT EXISTS idx_bk_receipts_txn ON bk_receipts(transaction_id);
      `)
    }
  },
  {
    version: 2,
    description: 'Seed default categories',
    up: (db) => {
      // Income categories
      const incomeCategories = [
        ['inc-sales', 'Sales Revenue', 'income', null, 'business_income'],
        ['inc-services', 'Service Revenue', 'income', null, 'business_income'],
        ['inc-interest', 'Interest Income', 'income', null, 'interest_income'],
        ['inc-other', 'Other Income', 'income', null, 'other_income']
      ]

      // Expense categories
      const expenseCategories = [
        ['exp-advertising', 'Advertising & Marketing', 'expense', null, 'advertising'],
        ['exp-bank-fees', 'Bank Fees & Charges', 'expense', null, 'bank_fees'],
        ['exp-contractors', 'Contractors & Freelancers', 'expense', null, 'contract_labor'],
        ['exp-equipment', 'Equipment & Tools', 'expense', null, 'equipment'],
        ['exp-insurance', 'Insurance', 'expense', null, 'insurance'],
        ['exp-meals', 'Meals & Entertainment', 'expense', null, 'meals'],
        ['exp-office', 'Office Supplies', 'expense', null, 'office_supplies'],
        ['exp-professional', 'Professional Services', 'expense', null, 'professional_services'],
        ['exp-rent', 'Rent & Lease', 'expense', null, 'rent'],
        ['exp-software', 'Software & Subscriptions', 'expense', null, 'software'],
        ['exp-travel', 'Travel', 'expense', null, 'travel'],
        ['exp-utilities', 'Utilities', 'expense', null, 'utilities'],
        ['exp-other', 'Other Expenses', 'expense', null, 'other_expenses']
      ]

      const allCategories = [...incomeCategories, ...expenseCategories]
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO bk_categories (id, name, type, parent_id, tax_category, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      )

      allCategories.forEach((cat, index) => {
        stmt.run(cat[0], cat[1], cat[2], cat[3], cat[4], index)
      })
    }
  }
]
