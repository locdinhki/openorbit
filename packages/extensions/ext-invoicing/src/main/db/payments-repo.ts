import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface InvoicePaymentRow {
  id: string
  invoice_id: string
  amount: number
  payment_date: string
  payment_method: string
  stripe_payment_id: string | null
  notes: string | null
  created_at: string
}

export interface CreatePaymentInput {
  invoiceId: string
  amount: number
  paymentMethod: string
  paymentDate?: string
  stripePaymentId?: string
  notes?: string
}

export class InvoicePaymentsRepo {
  constructor(private db: Database.Database) {}

  create(input: CreatePaymentInput): InvoicePaymentRow {
    const id = randomUUID()

    this.db
      .prepare(
        `INSERT INTO invoice_payments (id, invoice_id, amount, payment_date, payment_method, stripe_payment_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.invoiceId,
        input.amount,
        input.paymentDate ?? new Date().toISOString().split('T')[0],
        input.paymentMethod,
        input.stripePaymentId ?? null,
        input.notes ?? null
      )

    return this.getById(id)!
  }

  getById(id: string): InvoicePaymentRow | null {
    return (
      (this.db.prepare('SELECT * FROM invoice_payments WHERE id = ?').get(id) as
        | InvoicePaymentRow
        | undefined) ?? null
    )
  }

  listByInvoice(invoiceId: string): InvoicePaymentRow[] {
    return this.db
      .prepare('SELECT * FROM invoice_payments WHERE invoice_id = ? ORDER BY payment_date DESC')
      .all(invoiceId) as InvoicePaymentRow[]
  }

  list(opts?: { invoiceId?: string; limit?: number }): InvoicePaymentRow[] {
    const limit = opts?.limit ?? 100

    if (opts?.invoiceId) {
      return this.listByInvoice(opts.invoiceId)
    }

    return this.db
      .prepare('SELECT * FROM invoice_payments ORDER BY payment_date DESC LIMIT ?')
      .all(limit) as InvoicePaymentRow[]
  }

  sumByInvoice(invoiceId: string): number {
    const row = this.db
      .prepare(
        'SELECT COALESCE(SUM(amount), 0) as total FROM invoice_payments WHERE invoice_id = ?'
      )
      .get(invoiceId) as { total: number }
    return row.total
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM invoice_payments WHERE id = ?').run(id)
  }

  deleteByInvoice(invoiceId: string): void {
    this.db.prepare('DELETE FROM invoice_payments WHERE invoice_id = ?').run(invoiceId)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM invoice_payments').get() as {
      cnt: number
    }
    return row.cnt
  }

  sumTotal(): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(amount), 0) as total FROM invoice_payments')
      .get() as { total: number }
    return row.total
  }
}
