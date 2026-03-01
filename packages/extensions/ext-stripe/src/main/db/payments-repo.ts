import type Database from 'better-sqlite3'
import type Stripe from 'stripe'

export interface StripePaymentRow {
  id: string
  customer_id: string | null
  amount: number
  currency: string
  status: string
  payment_method: string | null
  invoice_id: string | null
  description: string | null
  metadata: string
  raw: string
  created_at: string
  synced_at: string
}

export class StripePaymentsRepo {
  constructor(private db: Database.Database) {}

  upsert(payment: Stripe.PaymentIntent): void {
    const customerId =
      typeof payment.customer === 'string' ? payment.customer : (payment.customer?.id ?? null)
    const paymentMethod =
      typeof payment.payment_method === 'string'
        ? payment.payment_method
        : (payment.payment_method?.id ?? null)

    this.db
      .prepare(
        `INSERT INTO stripe_payments (id, customer_id, amount, currency, status, payment_method, invoice_id, description, metadata, raw, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           customer_id = excluded.customer_id,
           amount = excluded.amount,
           currency = excluded.currency,
           status = excluded.status,
           payment_method = excluded.payment_method,
           invoice_id = excluded.invoice_id,
           description = excluded.description,
           metadata = excluded.metadata,
           raw = excluded.raw,
           synced_at = datetime('now')`
      )
      .run(
        payment.id,
        customerId,
        payment.amount,
        payment.currency,
        payment.status,
        paymentMethod,
        typeof payment.invoice === 'string' ? payment.invoice : (payment.invoice?.id ?? null),
        payment.description ?? null,
        JSON.stringify(payment.metadata ?? {}),
        JSON.stringify(payment)
      )
  }

  getById(id: string): StripePaymentRow | null {
    return (
      (this.db.prepare('SELECT * FROM stripe_payments WHERE id = ?').get(id) as
        | StripePaymentRow
        | undefined) ?? null
    )
  }

  listByCustomer(customerId: string, limit = 50): StripePaymentRow[] {
    return this.db
      .prepare(
        'SELECT * FROM stripe_payments WHERE customer_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(customerId, limit) as StripePaymentRow[]
  }

  list(opts?: {
    customerId?: string
    status?: string
    limit?: number
    offset?: number
  }): StripePaymentRow[] {
    const limit = opts?.limit ?? 100
    const offset = opts?.offset ?? 0

    let sql = 'SELECT * FROM stripe_payments WHERE 1=1'
    const params: unknown[] = []

    if (opts?.customerId) {
      sql += ' AND customer_id = ?'
      params.push(opts.customerId)
    }
    if (opts?.status) {
      sql += ' AND status = ?'
      params.push(opts.status)
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    return this.db.prepare(sql).all(...params) as StripePaymentRow[]
  }

  sumByStatus(status: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM stripe_payments WHERE status = ?')
      .get(status) as { total: number }
    return row.total
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM stripe_payments').get() as {
      cnt: number
    }
    return row.cnt
  }

  countByDateRange(startDate: string, endDate: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM stripe_payments
         WHERE created_at >= ? AND created_at < ? AND status = 'succeeded'`
      )
      .get(startDate, endDate) as { cnt: number }
    return row.cnt
  }

  sumByDateRange(startDate: string, endDate: string): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) as total FROM stripe_payments
         WHERE created_at >= ? AND created_at < ? AND status = 'succeeded'`
      )
      .get(startDate, endDate) as { total: number }
    return row.total
  }
}
