import { useExtBookkeepingStore } from '../store/index'
import CategorySelect from './CategorySelect'

export default function TransactionList(): React.JSX.Element {
  const {
    transactions,
    categories,
    updateTransaction,
    deleteTransaction,
    loading,
    showUncategorized
  } = useExtBookkeepingStore()

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Math.abs(amount))
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleCategoryChange = async (txnId: string, categoryId: string | null): Promise<void> => {
    await updateTransaction(txnId, { categoryId })
  }

  const handleDelete = async (txnId: string): Promise<void> => {
    if (confirm('Delete this transaction?')) {
      await deleteTransaction(txnId)
    }
  }

  const getCategoryName = (categoryId: string | null): string => {
    if (!categoryId) return 'Uncategorized'
    const cat = categories.find((c) => c.id === categoryId)
    return cat?.name ?? 'Unknown'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)]">
        Loading transactions...
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--cos-text-muted)]">
        <p className="text-sm">
          {showUncategorized ? 'No uncategorized transactions' : 'No transactions found'}
        </p>
        <p className="text-xs mt-1">Import from Plaid or add transactions manually</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--cos-border)]">
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--cos-text-muted)] uppercase">
                Date
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--cos-text-muted)] uppercase">
                Description
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-[var(--cos-text-muted)] uppercase">
                Category
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--cos-text-muted)] uppercase">
                Amount
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium text-[var(--cos-text-muted)] uppercase w-16"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn) => (
              <tr
                key={txn.id}
                className="border-b border-[var(--cos-border)] last:border-0 hover:bg-[var(--cos-bg-primary)]/50"
              >
                <td className="px-3 py-2 text-sm text-[var(--cos-text-muted)]">
                  {formatDate(txn.date)}
                </td>
                <td className="px-3 py-2">
                  <p className="text-sm font-medium truncate max-w-xs">{txn.description}</p>
                  {txn.payee && <p className="text-xs text-[var(--cos-text-muted)]">{txn.payee}</p>}
                  {txn.ai_suggested_category_id && !txn.category_id && (
                    <p className="text-xs text-amber-400">
                      AI suggests: {getCategoryName(txn.ai_suggested_category_id)} (
                      {Math.round((txn.ai_confidence ?? 0) * 100)}%)
                    </p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <CategorySelect
                    categories={categories}
                    value={txn.category_id}
                    onChange={(catId) => handleCategoryChange(txn.id, catId)}
                    transactionAmount={txn.amount}
                  />
                </td>
                <td
                  className={`px-3 py-2 text-sm font-medium text-right ${
                    txn.amount < 0 ? 'text-red-400' : 'text-green-400'
                  }`}
                >
                  {txn.amount < 0 ? '-' : '+'}
                  {formatCurrency(txn.amount)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => handleDelete(txn.id)}
                    className="text-[var(--cos-text-muted)] hover:text-red-400 text-xs cursor-pointer"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
