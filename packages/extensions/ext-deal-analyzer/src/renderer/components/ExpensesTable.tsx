// ============================================================================
// ext-deal-analyzer — Expenses Table Component
// ============================================================================

import type React from 'react'
import type { DealExpenseRow } from '../lib/ipc-client'

interface ExpensesTableProps {
  expenses: DealExpenseRow[]
  onDelete?: (id: string) => void
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const categoryColors: Record<string, string> = {
  repair: 'bg-orange-500/20 text-orange-400',
  renovation: 'bg-purple-500/20 text-purple-400',
  closing: 'bg-blue-500/20 text-blue-400',
  holding: 'bg-yellow-500/20 text-yellow-400',
  other: 'bg-zinc-500/20 text-zinc-400'
}

export default function ExpensesTable({
  expenses,
  onDelete
}: ExpensesTableProps): React.JSX.Element {
  if (expenses.length === 0) {
    return (
      <div className="p-4 text-center text-zinc-500 text-sm">No additional expenses added yet.</div>
    )
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  // Group by category
  const byCategory = expenses.reduce(
    (acc, exp) => {
      if (!acc[exp.category]) acc[exp.category] = []
      acc[exp.category].push(exp)
      return acc
    },
    {} as Record<string, DealExpenseRow[]>
  )

  return (
    <div className="space-y-3">
      <div className="px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg flex justify-between items-center">
        <span className="text-xs text-zinc-400 uppercase tracking-wide">Total Expenses</span>
        <span className="font-semibold text-zinc-200">{formatCurrency(total)}</span>
      </div>

      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${categoryColors[category] ?? categoryColors.other}`}
            >
              {category}
            </span>
            <span className="text-xs text-zinc-500">
              {formatCurrency(items.reduce((s, e) => s + e.amount, 0))}
            </span>
          </div>

          <div className="space-y-1">
            {items.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between px-3 py-2 bg-zinc-800/30 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="text-zinc-300">{expense.description}</span>
                  {expense.isRecurring && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/20 text-green-400">
                      Recurring
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-200">{formatCurrency(expense.amount)}</span>
                  {onDelete && (
                    <button
                      onClick={() => onDelete(expense.id)}
                      className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete expense"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
