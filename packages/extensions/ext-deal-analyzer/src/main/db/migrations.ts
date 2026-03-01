// ============================================================================
// ext-deal-analyzer — Database Migrations
// ============================================================================

import type { ExtensionMigration } from '@openorbit/core/extensions/types'

export const extDealAnalyzerMigrations: ExtensionMigration[] = [
  {
    version: 1,
    description: 'Create deals, deal_comps, and deal_expenses tables',
    up: (db) => {
      db.exec(`
        -- Main deals table (20 columns)
        CREATE TABLE IF NOT EXISTS deals (
          id                  TEXT PRIMARY KEY,
          address             TEXT NOT NULL,
          city                TEXT NOT NULL,
          state               TEXT NOT NULL,
          postal_code         TEXT NOT NULL,
          property_type       TEXT NOT NULL DEFAULT 'single-family',
          purchase_price      REAL NOT NULL,
          after_repair_value  REAL,
          estimated_rent      REAL,
          repair_costs        REAL DEFAULT 0,
          down_payment_pct    REAL DEFAULT 20,
          interest_rate       REAL DEFAULT 7,
          loan_term_years     INTEGER DEFAULT 30,
          closing_costs       REAL DEFAULT 0,
          property_tax_rate   REAL DEFAULT 1.25,
          insurance_annual    REAL DEFAULT 0,
          hoa_monthly         REAL DEFAULT 0,
          vacancy_rate        REAL DEFAULT 5,
          management_rate     REAL DEFAULT 10,
          maintenance_rate    REAL DEFAULT 5,
          notes               TEXT,
          ghl_contact_id      TEXT,
          ghl_opportunity_id  TEXT,
          status              TEXT DEFAULT 'active',
          created_at          TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
        CREATE INDEX IF NOT EXISTS idx_deals_address ON deals(address, city, state);
        CREATE INDEX IF NOT EXISTS idx_deals_ghl ON deals(ghl_contact_id, ghl_opportunity_id);

        -- Comparable sales table (12 columns)
        CREATE TABLE IF NOT EXISTS deal_comps (
          id            TEXT PRIMARY KEY,
          deal_id       TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
          address       TEXT NOT NULL,
          city          TEXT NOT NULL,
          state         TEXT NOT NULL,
          postal_code   TEXT NOT NULL,
          sale_price    REAL NOT NULL,
          sale_date     TEXT,
          square_feet   INTEGER,
          bedrooms      INTEGER,
          bathrooms     REAL,
          year_built    INTEGER,
          zillow_url    TEXT,
          notes         TEXT,
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_deal_comps_deal ON deal_comps(deal_id);

        -- Expense line items table (6 columns)
        CREATE TABLE IF NOT EXISTS deal_expenses (
          id            TEXT PRIMARY KEY,
          deal_id       TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
          category      TEXT NOT NULL,
          description   TEXT NOT NULL,
          amount        REAL NOT NULL,
          is_recurring  INTEGER DEFAULT 0,
          created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_deal_expenses_deal ON deal_expenses(deal_id);
        CREATE INDEX IF NOT EXISTS idx_deal_expenses_category ON deal_expenses(category);
      `)
    }
  }
]
