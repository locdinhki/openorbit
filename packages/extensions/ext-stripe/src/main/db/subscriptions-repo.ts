import type Database from 'better-sqlite3'
import type Stripe from 'stripe'

export interface StripeSubscriptionRow {
  id: string
  customer_id: string
  status: string
  current_period_start: string | null
  current_period_end: string | null
  items: string
  cancel_at_period_end: number
  metadata: string
  raw: string
  created_at: string
  synced_at: string
}

export class StripeSubscriptionsRepo {
  constructor(private db: Database.Database) {}

  upsert(sub: Stripe.Subscription): void {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
    const items = sub.items?.data.map((item) => ({
      id: item.id,
      priceId: item.price?.id,
      productId:
        typeof item.price?.product === 'string' ? item.price.product : item.price?.product?.id,
      quantity: item.quantity
    }))

    this.db
      .prepare(
        `INSERT INTO stripe_subscriptions (id, customer_id, status, current_period_start, current_period_end, items, cancel_at_period_end, metadata, raw, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           customer_id = excluded.customer_id,
           status = excluded.status,
           current_period_start = excluded.current_period_start,
           current_period_end = excluded.current_period_end,
           items = excluded.items,
           cancel_at_period_end = excluded.cancel_at_period_end,
           metadata = excluded.metadata,
           raw = excluded.raw,
           synced_at = datetime('now')`
      )
      .run(
        sub.id,
        customerId,
        sub.status,
        sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null,
        sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        JSON.stringify(items ?? []),
        sub.cancel_at_period_end ? 1 : 0,
        JSON.stringify(sub.metadata ?? {}),
        JSON.stringify(sub)
      )
  }

  getById(id: string): StripeSubscriptionRow | null {
    return (
      (this.db.prepare('SELECT * FROM stripe_subscriptions WHERE id = ?').get(id) as
        | StripeSubscriptionRow
        | undefined) ?? null
    )
  }

  listByCustomer(customerId: string): StripeSubscriptionRow[] {
    return this.db
      .prepare('SELECT * FROM stripe_subscriptions WHERE customer_id = ? ORDER BY created_at DESC')
      .all(customerId) as StripeSubscriptionRow[]
  }

  list(opts?: {
    customerId?: string
    status?: string
    limit?: number
    offset?: number
  }): StripeSubscriptionRow[] {
    const limit = opts?.limit ?? 100
    const offset = opts?.offset ?? 0

    let sql = 'SELECT * FROM stripe_subscriptions WHERE 1=1'
    const params: unknown[] = []

    if (opts?.customerId) {
      sql += ' AND customer_id = ?'
      params.push(opts.customerId)
    }
    if (opts?.status && opts.status !== 'all') {
      sql += ' AND status = ?'
      params.push(opts.status)
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    return this.db.prepare(sql).all(...params) as StripeSubscriptionRow[]
  }

  countByStatus(status: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM stripe_subscriptions WHERE status = ?')
      .get(status) as { cnt: number }
    return row.cnt
  }

  getMRR(): number {
    // Sum monthly amounts for active subscriptions
    // This is simplified - real implementation would parse items and calculate properly
    const rows = this.db
      .prepare("SELECT raw FROM stripe_subscriptions WHERE status = 'active'")
      .all() as { raw: string }[]

    let mrr = 0
    for (const row of rows) {
      try {
        const sub = JSON.parse(row.raw) as Stripe.Subscription
        for (const item of sub.items?.data ?? []) {
          const price = item.price
          if (price?.recurring?.interval === 'month') {
            mrr += (price.unit_amount ?? 0) * (item.quantity ?? 1)
          } else if (price?.recurring?.interval === 'year') {
            mrr += ((price.unit_amount ?? 0) * (item.quantity ?? 1)) / 12
          }
        }
      } catch {
        // Skip invalid entries
      }
    }
    return Math.round(mrr)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM stripe_subscriptions').get() as {
      cnt: number
    }
    return row.cnt
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM stripe_subscriptions WHERE id = ?').run(id)
  }
}
