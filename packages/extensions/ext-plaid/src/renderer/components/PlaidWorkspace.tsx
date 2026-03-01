import { useEffect } from 'react'
import { useExtPlaidStore } from '../store/index'
import Badge from '@renderer/components/shared/Badge'
import Button from '@renderer/components/shared/Button'

export default function PlaidWorkspace(): React.JSX.Element {
  const {
    hasCredentials,
    accounts,
    transactions,
    loadTransactions,
    syncTransactions,
    syncingTransactions,
    selectedAccountId
  } = useExtPlaidStore()

  useEffect(() => {
    if (hasCredentials) {
      loadTransactions(selectedAccountId ?? undefined)
    }
  }, [hasCredentials, selectedAccountId, loadTransactions])

  if (!hasCredentials) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)] text-sm">
        Configure Plaid credentials to view transactions
      </div>
    )
  }

  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId)
    : null

  const formatAmount = (amount: number): string => {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Math.abs(amount))
    return amount < 0 ? `-${formatted}` : formatted
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--cos-text-primary)]">
            {selectedAccount ? selectedAccount.name : 'All Transactions'}
          </h1>
          <p className="text-sm text-[var(--cos-text-muted)]">
            {selectedAccount
              ? `${selectedAccount.type} account ••${selectedAccount.mask || ''}`
              : `${transactions.length} transactions`}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => syncTransactions()}
          disabled={syncingTransactions}
        >
          {syncingTransactions ? 'Syncing...' : 'Sync Transactions'}
        </Button>
      </div>

      {/* Transaction List */}
      {transactions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--cos-text-muted)]">No transactions found</p>
          <p className="text-xs text-[var(--cos-text-muted)] mt-1">
            Click &quot;Sync Transactions&quot; to fetch from your bank
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((txn) => (
            <div
              key={txn.id}
              className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--cos-text-primary)] truncate">
                    {txn.merchant_name || txn.name}
                  </p>
                  {txn.merchant_name && txn.merchant_name !== txn.name && (
                    <p className="text-xs text-[var(--cos-text-muted)] truncate">{txn.name}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-[var(--cos-text-muted)]">{formatDate(txn.date)}</p>
                    {txn.pending === 1 && <Badge variant="warning">Pending</Badge>}
                    {txn.category && (
                      <span className="text-xs text-[var(--cos-text-muted)]">
                        {JSON.parse(txn.category).join(' > ')}
                      </span>
                    )}
                  </div>
                </div>
                <p
                  className={`text-sm font-medium whitespace-nowrap ${
                    txn.amount < 0 ? 'text-green-400' : 'text-[var(--cos-text-primary)]'
                  }`}
                >
                  {formatAmount(txn.amount)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
