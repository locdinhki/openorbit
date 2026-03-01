import type Database from 'better-sqlite3'
import type Stripe from 'stripe'

export interface StripePaymentLinkRow {
  id: string
  url: string
  active: number
  amount: number
  currency: string
  description: string | null
  metadata: string
  created_at: string
}

export class StripePaymentLinksRepo {
  constructor(private db: Database.Database) {}

  insert(link: Stripe.PaymentLink, amount: number, description?: string): void {
    this.db
      .prepare(
        `INSERT INTO stripe_payment_links (id, url, active, amount, currency, description, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .run(
        link.id,
        link.url,
        link.active ? 1 : 0,
        amount,
        link.currency ?? 'usd',
        description ?? null,
        JSON.stringify(link.metadata ?? {})
      )
  }

  getById(id: string): StripePaymentLinkRow | null {
    return (
      (this.db.prepare('SELECT * FROM stripe_payment_links WHERE id = ?').get(id) as
        | StripePaymentLinkRow
        | undefined) ?? null
    )
  }

  list(opts?: { active?: boolean; limit?: number }): StripePaymentLinkRow[] {
    const limit = opts?.limit ?? 100

    if (opts?.active !== undefined) {
      return this.db
        .prepare(
          'SELECT * FROM stripe_payment_links WHERE active = ? ORDER BY created_at DESC LIMIT ?'
        )
        .all(opts.active ? 1 : 0, limit) as StripePaymentLinkRow[]
    }

    return this.db
      .prepare('SELECT * FROM stripe_payment_links ORDER BY created_at DESC LIMIT ?')
      .all(limit) as StripePaymentLinkRow[]
  }

  updateActive(id: string, active: boolean): void {
    this.db
      .prepare('UPDATE stripe_payment_links SET active = ? WHERE id = ?')
      .run(active ? 1 : 0, id)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM stripe_payment_links').get() as {
      cnt: number
    }
    return row.cnt
  }
}
