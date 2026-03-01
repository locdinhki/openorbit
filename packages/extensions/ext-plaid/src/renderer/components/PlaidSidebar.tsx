import { useState, useEffect, lazy, Suspense } from 'react'
import { useExtPlaidStore } from '../store/index'
import PlaidLinkButton from './PlaidLinkButton'
import Button from '@renderer/components/shared/Button'
import Badge from '@renderer/components/shared/Badge'

const LazyPlaidSettings = lazy(() => import('./settings/PlaidSettings'))

export default function PlaidSidebar(): React.JSX.Element {
  const [showSettings, setShowSettings] = useState(false)

  const {
    hasCredentials,
    loadSettings,
    items,
    accounts,
    loadItems,
    loadAccounts,
    syncing,
    syncAccounts,
    selectAccount,
    selectedAccountId,
    removeItem
  } = useExtPlaidStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (hasCredentials) {
      loadItems()
      loadAccounts()
    }
  }, [hasCredentials, loadItems, loadAccounts])

  if (showSettings) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center px-3 py-2 border-b border-[var(--cos-border)]">
          <button
            onClick={() => setShowSettings(false)}
            className="text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer text-xs mr-2"
          >
            &larr;
          </button>
          <span className="text-xs font-medium text-[var(--cos-text-primary)]">Settings</span>
        </div>
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
              Loading...
            </div>
          }
        >
          <LazyPlaidSettings />
        </Suspense>
      </div>
    )
  }

  const formatBalance = (balance: number | null): string => {
    if (balance === null) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(balance)
  }

  const totalBalance = accounts.reduce((sum, a) => sum + (a.current_balance ?? 0), 0)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--cos-border)]">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">Bank Accounts</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => syncAccounts()}
            disabled={syncing || !hasCredentials}
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
          <button
            onClick={() => setShowSettings(true)}
            className="text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer text-sm px-1"
            title="Settings"
          >
            &#9881;
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasCredentials ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-2">
            <p className="text-xs text-[var(--cos-text-muted)] text-center">
              Configure your Plaid credentials to connect bank accounts
            </p>
            <Button size="sm" variant="primary" onClick={() => setShowSettings(true)}>
              Configure
            </Button>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {/* Total Balance */}
            {accounts.length > 0 && (
              <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-3">
                <p className="text-xs text-[var(--cos-text-muted)]">Total Balance</p>
                <p className="text-lg font-semibold text-[var(--cos-text-primary)]">
                  {formatBalance(totalBalance)}
                </p>
              </div>
            )}

            {/* Connect Bank */}
            <PlaidLinkButton />

            {/* Connected Banks */}
            {items.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2">
                  Connected Banks
                </h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded p-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {item.institution_name || 'Unknown Bank'}
                        </p>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                      <Badge variant={item.status === 'active' ? 'success' : 'error'}>
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accounts */}
            {accounts.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2">
                  Accounts
                </h3>
                <div className="space-y-1">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      onClick={() =>
                        selectAccount(account.id === selectedAccountId ? null : account.id)
                      }
                      className={`p-2 rounded cursor-pointer transition-colors ${
                        account.id === selectedAccountId
                          ? 'bg-indigo-600/15 border border-indigo-500/40'
                          : 'bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] hover:border-[var(--cos-border-light)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{account.name}</p>
                          <p className="text-xs text-[var(--cos-text-muted)]">
                            {account.type} {account.mask ? `••${account.mask}` : ''}
                          </p>
                        </div>
                        <p className="text-sm font-medium">
                          {formatBalance(account.current_balance)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {items.length === 0 && (
              <div className="text-center py-4">
                <p className="text-xs text-[var(--cos-text-muted)]">
                  No bank accounts connected yet
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
