import type Database from 'better-sqlite3'
import type Stripe from 'stripe'

export interface StripeCustomerRow {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  ghl_contact_id: string | null
  metadata: string
  raw: string
  created_at: string
  synced_at: string
}

export class StripeCustomersRepo {
  constructor(private db: Database.Database) {}

  upsert(customer: Stripe.Customer): void {
    this.db
      .prepare(
        `INSERT INTO stripe_customers (id, email, name, phone, metadata, raw, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           name = excluded.name,
           phone = excluded.phone,
           metadata = excluded.metadata,
           raw = excluded.raw,
           synced_at = datetime('now')`
      )
      .run(
        customer.id,
        customer.email ?? null,
        customer.name ?? null,
        customer.phone ?? null,
        JSON.stringify(customer.metadata ?? {}),
        JSON.stringify(customer)
      )
  }

  getById(id: string): StripeCustomerRow | null {
    return (
      (this.db.prepare('SELECT * FROM stripe_customers WHERE id = ?').get(id) as
        | StripeCustomerRow
        | undefined) ?? null
    )
  }

  getByEmail(email: string): StripeCustomerRow | null {
    return (
      (this.db.prepare('SELECT * FROM stripe_customers WHERE email = ?').get(email) as
        | StripeCustomerRow
        | undefined) ?? null
    )
  }

  list(opts?: { query?: string; limit?: number; offset?: number }): StripeCustomerRow[] {
    const limit = opts?.limit ?? 100
    const offset = opts?.offset ?? 0

    if (opts?.query) {
      const q = `%${opts.query}%`
      return this.db
        .prepare(
          `SELECT * FROM stripe_customers
           WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?
           ORDER BY synced_at DESC LIMIT ? OFFSET ?`
        )
        .all(q, q, q, limit, offset) as StripeCustomerRow[]
    }

    return this.db
      .prepare('SELECT * FROM stripe_customers ORDER BY synced_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as StripeCustomerRow[]
  }

  linkToGhl(customerId: string, ghlContactId: string): void {
    this.db
      .prepare('UPDATE stripe_customers SET ghl_contact_id = ? WHERE id = ?')
      .run(ghlContactId, customerId)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM stripe_customers').get() as {
      cnt: number
    }
    return row.cnt
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM stripe_customers WHERE id = ?').run(id)
  }
}
