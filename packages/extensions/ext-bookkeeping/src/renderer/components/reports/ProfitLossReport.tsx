import type { ProfitLossReport as PLReport } from '../../../main/reports/profit-loss'

interface Props {
  report: PLReport
}

export default function ProfitLossReport({ report }: Props): React.JSX.Element {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[var(--cos-text-primary)]">
          Profit & Loss Statement
        </h1>
        <p className="text-sm text-[var(--cos-text-muted)]">
          {formatDate(report.startDate)} - {formatDate(report.endDate)}
        </p>
      </div>

      {/* Income Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-green-400 mb-3 border-b border-green-500/30 pb-2">
          Income
        </h2>
        {report.income.categories.length === 0 ? (
          <p className="text-sm text-[var(--cos-text-muted)] italic">No income recorded</p>
        ) : (
          <div className="space-y-2">
            {report.income.categories.map((cat) => (
              <CategoryRow key={cat.id} category={cat} formatCurrency={formatCurrency} />
            ))}
          </div>
        )}
        <div className="flex justify-between font-semibold text-green-400 mt-3 pt-2 border-t border-[var(--cos-border)]">
          <span>Total Income</span>
          <span>{formatCurrency(report.income.total)}</span>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-red-400 mb-3 border-b border-red-500/30 pb-2">
          Expenses
        </h2>
        {report.expenses.categories.length === 0 ? (
          <p className="text-sm text-[var(--cos-text-muted)] italic">No expenses recorded</p>
        ) : (
          <div className="space-y-2">
            {report.expenses.categories.map((cat) => (
              <CategoryRow key={cat.id} category={cat} formatCurrency={formatCurrency} />
            ))}
          </div>
        )}
        <div className="flex justify-between font-semibold text-red-400 mt-3 pt-2 border-t border-[var(--cos-border)]">
          <span>Total Expenses</span>
          <span>{formatCurrency(report.expenses.total)}</span>
        </div>
      </div>

      {/* Net Income */}
      <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold">Net Income</span>
          <span
            className={`text-2xl font-bold ${
              report.netIncome >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {formatCurrency(report.netIncome)}
          </span>
        </div>
        <p className="text-xs text-[var(--cos-text-muted)] mt-1">
          {report.netIncome >= 0 ? 'Profit' : 'Loss'} for the period
        </p>
      </div>
    </div>
  )
}

function CategoryRow({
  category,
  formatCurrency,
  level = 0
}: {
  category: {
    id: string
    name: string
    amount: number
    children?: { id: string; name: string; amount: number }[]
  }
  formatCurrency: (amount: number) => string
  level?: number
}): React.JSX.Element {
  const indent = level * 16

  return (
    <>
      <div className="flex justify-between text-sm py-1" style={{ paddingLeft: indent }}>
        <span className={level > 0 ? 'text-[var(--cos-text-muted)]' : ''}>
          {level > 0 && '└ '}
          {category.name}
        </span>
        <span>{formatCurrency(category.amount)}</span>
      </div>
      {category.children?.map((child) => (
        <CategoryRow
          key={child.id}
          category={child}
          formatCurrency={formatCurrency}
          level={level + 1}
        />
      ))}
    </>
  )
}
