// ============================================================================
// Recurring Invoice Scheduler
// ============================================================================

import type { InvoicesRepo, CreateInvoiceInput } from '../db/invoices-repo'
import type { InvoiceItemsRepo } from '../db/invoice-items-repo'
import type { InvoiceRecurringRepo, InvoiceRecurringRow } from '../db/recurring-repo'

function addInterval(date: Date, frequency: string): Date {
  const result = new Date(date)
  switch (frequency) {
    case 'weekly':
      result.setDate(result.getDate() + 7)
      break
    case 'monthly':
      result.setMonth(result.getMonth() + 1)
      break
    case 'quarterly':
      result.setMonth(result.getMonth() + 3)
      break
    case 'yearly':
      result.setFullYear(result.getFullYear() + 1)
      break
  }
  return result
}

export class RecurringScheduler {
  constructor(
    private invoicesRepo: InvoicesRepo,
    private itemsRepo: InvoiceItemsRepo,
    private recurringRepo: InvoiceRecurringRepo
  ) {}

  async processDue(): Promise<{ generated: number; errors: number }> {
    const dueRecurrings = this.recurringRepo.getDue()
    let generated = 0
    let errors = 0

    for (const recurring of dueRecurrings) {
      try {
        await this.generateFromRecurring(recurring)
        generated++
      } catch {
        errors++
      }
    }

    return { generated, errors }
  }

  async generateFromRecurring(recurring: InvoiceRecurringRow): Promise<string> {
    const items = JSON.parse(recurring.items) as {
      description: string
      quantity: number
      unitPrice: number
    }[]

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const taxRate = 0 // Could be configurable
    const taxAmount = subtotal * (taxRate / 100)
    const total = subtotal + taxAmount

    // Calculate due date (e.g., 30 days from now)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    const invoiceInput: CreateInvoiceInput = {
      customerName: recurring.customer_name,
      customerEmail: recurring.customer_email,
      customerAddress: recurring.customer_address ?? undefined,
      customerPhone: recurring.customer_phone ?? undefined,
      subtotal,
      taxRate,
      taxAmount,
      total,
      dueDate: dueDate.toISOString().split('T')[0]
    }

    const invoice = this.invoicesRepo.create(invoiceInput)
    this.itemsRepo.createMany(invoice.id, items)

    // Calculate next date
    const currentDate = new Date(recurring.next_date)
    const nextDate = addInterval(currentDate, recurring.frequency)
    this.recurringRepo.markGenerated(recurring.id, nextDate.toISOString().split('T')[0])

    return invoice.id
  }

  getUpcoming(days = 7): InvoiceRecurringRow[] {
    const upcoming = this.recurringRepo.list({ active: true })
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + days)

    return upcoming.filter((r) => new Date(r.next_date) <= futureDate)
  }
}
