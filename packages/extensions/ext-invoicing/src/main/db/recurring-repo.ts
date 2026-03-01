import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface InvoiceRecurringRow {
  id: string
  customer_name: string
  customer_email: string
  customer_address: string | null
  customer_phone: string | null
  items: string
  frequency: string
  next_date: string
  last_generated: string | null
  auto_send: number
  paused: number
  created_at: string
}

export interface CreateRecurringInput {
  customerName: string
  customerEmail: string
  customerAddress?: string
  customerPhone?: string
  items: { description: string; quantity: number; unitPrice: number }[]
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  startDate: string
  autoSend?: boolean
}

export class InvoiceRecurringRepo {
  constructor(private db: Database.Database) {}

  create(input: CreateRecurringInput): InvoiceRecurringRow {
    const id = randomUUID()

    this.db
      .prepare(
        `INSERT INTO invoice_recurring (
          id, customer_name, customer_email, customer_address, customer_phone,
          items, frequency, next_date, auto_send
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.customerName,
        input.customerEmail,
        input.customerAddress ?? null,
        input.customerPhone ?? null,
        JSON.stringify(input.items),
        input.frequency,
        input.startDate,
        input.autoSend !== false ? 1 : 0
      )

    return this.getById(id)!
  }

  getById(id: string): InvoiceRecurringRow | null {
    return (
      (this.db.prepare('SELECT * FROM invoice_recurring WHERE id = ?').get(id) as
        | InvoiceRecurringRow
        | undefined) ?? null
    )
  }

  list(opts?: { active?: boolean }): InvoiceRecurringRow[] {
    if (opts?.active !== undefined) {
      return this.db
        .prepare('SELECT * FROM invoice_recurring WHERE paused = ? ORDER BY next_date ASC')
        .all(opts.active ? 0 : 1) as InvoiceRecurringRow[]
    }

    return this.db
      .prepare('SELECT * FROM invoice_recurring ORDER BY next_date ASC')
      .all() as InvoiceRecurringRow[]
  }

  getDue(): InvoiceRecurringRow[] {
    return this.db
      .prepare(
        `SELECT * FROM invoice_recurring
         WHERE paused = 0 AND next_date <= date('now')
         ORDER BY next_date ASC`
      )
      .all() as InvoiceRecurringRow[]
  }

  update(
    id: string,
    data: Partial<{
      items: { description: string; quantity: number; unitPrice: number }[]
      frequency: string
      nextDate: string
      autoSend: boolean
    }>
  ): void {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.items !== undefined) {
      sets.push('items = ?')
      params.push(JSON.stringify(data.items))
    }
    if (data.frequency !== undefined) {
      sets.push('frequency = ?')
      params.push(data.frequency)
    }
    if (data.nextDate !== undefined) {
      sets.push('next_date = ?')
      params.push(data.nextDate)
    }
    if (data.autoSend !== undefined) {
      sets.push('auto_send = ?')
      params.push(data.autoSend ? 1 : 0)
    }

    if (sets.length === 0) return

    params.push(id)
    this.db.prepare(`UPDATE invoice_recurring SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  setPaused(id: string, paused: boolean): void {
    this.db.prepare('UPDATE invoice_recurring SET paused = ? WHERE id = ?').run(paused ? 1 : 0, id)
  }

  markGenerated(id: string, nextDate: string): void {
    this.db
      .prepare(
        `UPDATE invoice_recurring
         SET last_generated = datetime('now'), next_date = ?
         WHERE id = ?`
      )
      .run(nextDate, id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM invoice_recurring WHERE id = ?').run(id)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM invoice_recurring').get() as {
      cnt: number
    }
    return row.cnt
  }
}
