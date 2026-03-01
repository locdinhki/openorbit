import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface InvoiceRow {
  id: string
  invoice_number: string
  status: string
  customer_name: string
  customer_email: string
  customer_address: string | null
  customer_phone: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  amount_paid: number
  due_date: string | null
  sent_at: string | null
  paid_at: string | null
  voided_at: string | null
  void_reason: string | null
  notes: string | null
  template_id: string | null
  stripe_payment_link_id: string | null
  stripe_payment_link_url: string | null
  created_at: string
  updated_at: string
}

export interface CreateInvoiceInput {
  customerName: string
  customerEmail: string
  customerAddress?: string
  customerPhone?: string
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  dueDate?: string
  notes?: string
  templateId?: string
}

export class InvoicesRepo {
  constructor(private db: Database.Database) {}

  private generateInvoiceNumber(): string {
    const year = new Date().getFullYear()
    const count = this.countByYear(year) + 1
    return `INV-${year}-${String(count).padStart(4, '0')}`
  }

  private countByYear(year: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM invoices WHERE invoice_number LIKE ?')
      .get(`INV-${year}-%`) as { cnt: number }
    return row.cnt
  }

  create(input: CreateInvoiceInput): InvoiceRow {
    const id = randomUUID()
    const invoiceNumber = this.generateInvoiceNumber()

    this.db
      .prepare(
        `INSERT INTO invoices (
          id, invoice_number, status, customer_name, customer_email, customer_address,
          customer_phone, subtotal, tax_rate, tax_amount, total, due_date, notes, template_id
        ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        invoiceNumber,
        input.customerName,
        input.customerEmail,
        input.customerAddress ?? null,
        input.customerPhone ?? null,
        input.subtotal,
        input.taxRate,
        input.taxAmount,
        input.total,
        input.dueDate ?? null,
        input.notes ?? null,
        input.templateId ?? null
      )

    return this.getById(id)!
  }

  getById(id: string): InvoiceRow | null {
    return (
      (this.db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as InvoiceRow | undefined) ??
      null
    )
  }

  getByNumber(invoiceNumber: string): InvoiceRow | null {
    return (
      (this.db.prepare('SELECT * FROM invoices WHERE invoice_number = ?').get(invoiceNumber) as
        | InvoiceRow
        | undefined) ?? null
    )
  }

  list(opts?: {
    status?: string
    customerId?: string
    limit?: number
    offset?: number
  }): InvoiceRow[] {
    const limit = opts?.limit ?? 100
    const offset = opts?.offset ?? 0

    let sql = 'SELECT * FROM invoices WHERE 1=1'
    const params: unknown[] = []

    if (opts?.status && opts.status !== 'all') {
      sql += ' AND status = ?'
      params.push(opts.status)
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    return this.db.prepare(sql).all(...params) as InvoiceRow[]
  }

  update(
    id: string,
    data: Partial<{
      customerName: string
      customerEmail: string
      customerAddress: string
      customerPhone: string
      subtotal: number
      taxRate: number
      taxAmount: number
      total: number
      dueDate: string
      notes: string
    }>
  ): void {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.customerName !== undefined) {
      sets.push('customer_name = ?')
      params.push(data.customerName)
    }
    if (data.customerEmail !== undefined) {
      sets.push('customer_email = ?')
      params.push(data.customerEmail)
    }
    if (data.customerAddress !== undefined) {
      sets.push('customer_address = ?')
      params.push(data.customerAddress)
    }
    if (data.customerPhone !== undefined) {
      sets.push('customer_phone = ?')
      params.push(data.customerPhone)
    }
    if (data.subtotal !== undefined) {
      sets.push('subtotal = ?')
      params.push(data.subtotal)
    }
    if (data.taxRate !== undefined) {
      sets.push('tax_rate = ?')
      params.push(data.taxRate)
    }
    if (data.taxAmount !== undefined) {
      sets.push('tax_amount = ?')
      params.push(data.taxAmount)
    }
    if (data.total !== undefined) {
      sets.push('total = ?')
      params.push(data.total)
    }
    if (data.dueDate !== undefined) {
      sets.push('due_date = ?')
      params.push(data.dueDate)
    }
    if (data.notes !== undefined) {
      sets.push('notes = ?')
      params.push(data.notes)
    }

    if (sets.length === 0) return

    sets.push("updated_at = datetime('now')")
    params.push(id)

    this.db.prepare(`UPDATE invoices SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  updateStatus(id: string, status: string): void {
    const statusUpdates: Record<string, string> = {
      sent: "sent_at = datetime('now')",
      paid: "paid_at = datetime('now')",
      void: "voided_at = datetime('now')"
    }

    let sql = `UPDATE invoices SET status = ?, updated_at = datetime('now')`
    if (statusUpdates[status]) {
      sql += `, ${statusUpdates[status]}`
    }
    sql += ' WHERE id = ?'

    this.db.prepare(sql).run(status, id)
  }

  updatePaymentLink(id: string, linkId: string, linkUrl: string): void {
    this.db
      .prepare(
        `UPDATE invoices SET
         stripe_payment_link_id = ?,
         stripe_payment_link_url = ?,
         updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(linkId, linkUrl, id)
  }

  updateAmountPaid(id: string, amountPaid: number): void {
    this.db
      .prepare(`UPDATE invoices SET amount_paid = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(amountPaid, id)
  }

  voidInvoice(id: string, reason?: string): void {
    this.db
      .prepare(
        `UPDATE invoices SET
         status = 'void',
         voided_at = datetime('now'),
         void_reason = ?,
         updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(reason ?? null, id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM invoices WHERE id = ?').run(id)
  }

  countByStatus(status: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM invoices WHERE status = ?')
      .get(status) as { cnt: number }
    return row.cnt
  }

  sumByStatus(status: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(SUM(total), 0) as total FROM invoices WHERE status = ?')
      .get(status) as { total: number }
    return row.total
  }

  getOverdueInvoices(): InvoiceRow[] {
    return this.db
      .prepare(
        `SELECT * FROM invoices
         WHERE status = 'sent' AND due_date < date('now')
         ORDER BY due_date ASC`
      )
      .all() as InvoiceRow[]
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM invoices').get() as { cnt: number }
    return row.cnt
  }
}
