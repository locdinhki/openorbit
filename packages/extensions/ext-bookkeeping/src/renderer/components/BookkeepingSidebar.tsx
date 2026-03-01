import { useEffect } from 'react'
import { useExtBookkeepingStore } from '../store/index'
import Button from '@renderer/components/shared/Button'
import Badge from '@renderer/components/shared/Badge'

export default function BookkeepingSidebar(): React.JSX.Element {
  const {
    accounts,
    transactions,
    loadAccounts,
    loadCategories,
    loadTransactions,
    selectAccount,
    selectedAccountId,
    showUncategorized,
    setShowUncategorized,
    importing,
    importFromPlaid
  } = useExtBookkeepingStore()

  useEffect(() => {
    loadAccounts()
    loadCategories()
    loadTransactions()
  }, [loadAccounts, loadCategories, loadTransactions])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const totalBalance = accounts.reduce((sum, a) => sum + a.current_balance, 0)
  const uncategorizedCount = transactions.filter((t) => !t.category_id).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--cos-border)]">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">Bookkeeping</span>
        <Button size="sm" variant="ghost" onClick={() => importFromPlaid()} disabled={importing}>
          {importing ? 'Importing...' : 'Import'}
        </Button>
      </div>

      {/* Total Balance */}
      <div className="px-3 py-3 border-b border-[var(--cos-border)] bg-[var(--cos-bg-tertiary)]">
        <p className="text-xs text-[var(--cos-text-muted)]">Total Balance</p>
        <p className="text-lg font-semibold text-[var(--cos-text-primary)]">
          {formatCurrency(totalBalance)}
        </p>
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2 border-b border-[var(--cos-border)]">
        <button
          onClick={() => setShowUncategorized(!showUncategorized)}
          className={`w-full flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
            showUncategorized
              ? 'bg-amber-500/15 text-amber-400'
              : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)]'
          }`}
        >
          <span>Uncategorized</span>
          <Badge variant={uncategorizedCount > 0 ? 'warning' : 'default'}>
            {uncategorizedCount}
          </Badge>
        </button>
      </div>

      {/* Accounts */}
      <div className="flex-1 overflow-y-auto p-2">
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2 px-1">
          Accounts
        </h3>
        {accounts.length === 0 ? (
          <p className="text-xs text-[var(--cos-text-muted)] text-center py-4">
            No accounts yet. Import from Plaid or create one manually.
          </p>
        ) : (
          <div className="space-y-1">
            <div
              onClick={() => selectAccount(null)}
              className={`p-2 rounded cursor-pointer transition-colors ${
                selectedAccountId === null && !showUncategorized
                  ? 'bg-indigo-600/15 border border-indigo-500/40'
                  : 'hover:bg-[var(--cos-bg-tertiary)]'
              }`}
            >
              <p className="text-sm font-medium">All Accounts</p>
            </div>
            {accounts.map((account) => (
              <div
                key={account.id}
                onClick={() => selectAccount(account.id)}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  account.id === selectedAccountId
                    ? 'bg-indigo-600/15 border border-indigo-500/40'
                    : 'bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] hover:border-[var(--cos-border-light)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{account.name}</p>
                    <p className="text-xs text-[var(--cos-text-muted)]">{account.type}</p>
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      account.current_balance >= 0 ? '' : 'text-red-400'
                    }`}
                  >
                    {formatCurrency(account.current_balance)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions Summary */}
      <div className="px-3 py-2 border-t border-[var(--cos-border)]">
        <p className="text-xs text-[var(--cos-text-muted)]">
          {transactions.length} transactions loaded
        </p>
      </div>
    </div>
  )
}
