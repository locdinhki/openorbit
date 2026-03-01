import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface InvoiceItemRow {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  sort_order: number
}

export interface CreateInvoiceItemInput {
  invoiceId: string
  description: string
  quantity: number
  unitPrice: number
  sortOrder?: number
}

export class InvoiceItemsRepo {
  constructor(private db: Database.Database) {}

  create(input: CreateInvoiceItemInput): InvoiceItemRow {
    const id = randomUUID()
    const amount = input.quantity * input.unitPrice

    this.db
      .prepare(
        `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.invoiceId,
        input.description,
        input.quantity,
        input.unitPrice,
        amount,
        input.sortOrder ?? 0
      )

    return this.getById(id)!
  }

  createMany(
    invoiceId: string,
    items: { description: string; quantity: number; unitPrice: number }[]
  ): void {
    const stmt = this.db.prepare(
      `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, amount, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )

    const insertMany = this.db.transaction((items: typeof items) => {
      items.forEach((item, index) => {
        const amount = item.quantity * item.unitPrice
        stmt.run(
          randomUUID(),
          invoiceId,
          item.description,
          item.quantity,
          item.unitPrice,
          amount,
          index
        )
      })
    })

    insertMany(items)
  }

  getById(id: string): InvoiceItemRow | null {
    return (
      (this.db.prepare('SELECT * FROM invoice_items WHERE id = ?').get(id) as
        | InvoiceItemRow
        | undefined) ?? null
    )
  }

  listByInvoice(invoiceId: string): InvoiceItemRow[] {
    return this.db
      .prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC')
      .all(invoiceId) as InvoiceItemRow[]
  }

  update(
    id: string,
    data: Partial<{
      description: string
      quantity: number
      unitPrice: number
      sortOrder: number
    }>
  ): void {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.description !== undefined) {
      sets.push('description = ?')
      params.push(data.description)
    }
    if (data.quantity !== undefined) {
      sets.push('quantity = ?')
      params.push(data.quantity)
    }
    if (data.unitPrice !== undefined) {
      sets.push('unit_price = ?')
      params.push(data.unitPrice)
    }
    if (data.sortOrder !== undefined) {
      sets.push('sort_order = ?')
      params.push(data.sortOrder)
    }

    // Recalculate amount if quantity or unitPrice changed
    if (data.quantity !== undefined || data.unitPrice !== undefined) {
      const current = this.getById(id)
      if (current) {
        const qty = data.quantity ?? current.quantity
        const price = data.unitPrice ?? current.unit_price
        sets.push('amount = ?')
        params.push(qty * price)
      }
    }

    if (sets.length === 0) return

    params.push(id)
    this.db.prepare(`UPDATE invoice_items SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM invoice_items WHERE id = ?').run(id)
  }

  deleteByInvoice(invoiceId: string): void {
    this.db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId)
  }

  replaceForInvoice(
    invoiceId: string,
    items: { description: string; quantity: number; unitPrice: number }[]
  ): void {
    this.deleteByInvoice(invoiceId)
    this.createMany(invoiceId, items)
  }
}
