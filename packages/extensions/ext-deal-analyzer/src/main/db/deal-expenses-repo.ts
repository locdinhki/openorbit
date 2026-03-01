// ============================================================================
// ext-deal-analyzer — Deal Expenses Repository
// ============================================================================

import type { Database } from 'better-sqlite3'
import { v4 as uuid } from 'uuid'

export type ExpenseCategory = 'repair' | 'renovation' | 'closing' | 'holding' | 'other'

export interface DealExpenseRow {
  id: string
  dealId: string
  category: ExpenseCategory
  description: string
  amount: number
  isRecurring: boolean
  createdAt: string
}

export interface AddExpenseInput {
  dealId: string
  category: ExpenseCategory
  description: string
  amount: number
  isRecurring?: boolean
}

export class DealExpensesRepo {
  constructor(private db: Database) {}

  list(dealId: string): DealExpenseRow[] {
    const rows = this.db
      .prepare(
        `
        SELECT
          id, deal_id as dealId, category, description, amount,
          is_recurring as isRecurring, created_at as createdAt
        FROM deal_expenses
        WHERE deal_id = ?
        ORDER BY category, created_at DESC
      `
      )
      .all(dealId) as Array<{
      id: string
      dealId: string
      category: ExpenseCategory
      description: string
      amount: number
      isRecurring: number
      createdAt: string
    }>

    return rows.map((row) => ({
      ...row,
      isRecurring: row.isRecurring === 1
    }))
  }

  add(input: AddExpenseInput): DealExpenseRow {
    const id = uuid()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
        INSERT INTO deal_expenses (
          id, deal_id, category, description, amount, is_recurring, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        id,
        input.dealId,
        input.category,
        input.description,
        input.amount,
        input.isRecurring ? 1 : 0,
        now
      )

    return {
      id,
      dealId: input.dealId,
      category: input.category,
      description: input.description,
      amount: input.amount,
      isRecurring: input.isRecurring ?? false,
      createdAt: now
    }
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM deal_expenses WHERE id = ?').run(id)
    return result.changes > 0
  }

  getTotalByCategory(dealId: string): Record<ExpenseCategory, number> {
    const rows = this.db
      .prepare(
        `
        SELECT category, SUM(amount) as total
        FROM deal_expenses
        WHERE deal_id = ?
        GROUP BY category
      `
      )
      .all(dealId) as Array<{ category: ExpenseCategory; total: number }>

    const result: Record<ExpenseCategory, number> = {
      repair: 0,
      renovation: 0,
      closing: 0,
      holding: 0,
      other: 0
    }

    for (const row of rows) {
      result[row.category] = row.total
    }

    return result
  }

  getTotal(dealId: string): number {
    const row = this.db
      .prepare('SELECT SUM(amount) as total FROM deal_expenses WHERE deal_id = ?')
      .get(dealId) as { total: number | null }
    return row?.total ?? 0
  }
}
