import { useState, useEffect, lazy, Suspense } from 'react'
import { useExtStripeStore } from '../store/index'
import Button from '@renderer/components/shared/Button'
import Badge from '@renderer/components/shared/Badge'

const LazyStripeSettings = lazy(() => import('./settings/StripeSettings'))

type Tab = 'customers' | 'payments' | 'subscriptions'

export default function StripeSidebar(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('customers')
  const [showSettings, setShowSettings] = useState(false)

  const {
    hasSecretKey,
    loadSettings,
    customers,
    payments,
    subscriptions,
    loadCustomers,
    loadPayments,
    loadSubscriptions,
    syncing,
    syncingPayments,
    syncingSubscriptions,
    syncCustomers,
    syncPayments,
    syncSubscriptions,
    selectCustomer,
    selectedCustomerId
  } = useExtStripeStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    if (hasSecretKey) {
      loadCustomers()
      loadPayments()
      loadSubscriptions()
    }
  }, [hasSecretKey, loadCustomers, loadPayments, loadSubscriptions])

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
          <LazyStripeSettings />
        </Suspense>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'customers', label: 'Customers' },
    { key: 'payments', label: 'Payments' },
    { key: 'subscriptions', label: 'Subs' }
  ]

  const handleSync = (): void => {
    if (activeTab === 'customers') syncCustomers()
    else if (activeTab === 'payments') syncPayments()
    else if (activeTab === 'subscriptions') syncSubscriptions()
  }

  const isSyncing =
    activeTab === 'customers'
      ? syncing
      : activeTab === 'payments'
        ? syncingPayments
        : syncingSubscriptions

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--cos-border)]">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">Stripe</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSync}
            disabled={isSyncing || !hasSecretKey}
          >
            {isSyncing ? 'Syncing...' : 'Sync'}
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

      {/* Tabs */}
      <div className="flex border-b border-[var(--cos-border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-2 py-1.5 text-[10px] font-medium cursor-pointer transition-colors ${
              activeTab === tab.key
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!hasSecretKey ? (
          <div className="flex flex-col items-center justify-center h-32 px-4 gap-2">
            <p className="text-xs text-[var(--cos-text-muted)] text-center">
              Configure your Stripe API key to get started
            </p>
            <Button size="sm" variant="primary" onClick={() => setShowSettings(true)}>
              Configure
            </Button>
          </div>
        ) : (
          <>
            {activeTab === 'customers' && (
              <CustomerList
                customers={customers}
                selectedId={selectedCustomerId}
                onSelect={selectCustomer}
              />
            )}
            {activeTab === 'payments' && <PaymentList payments={payments} />}
            {activeTab === 'subscriptions' && <SubscriptionList subscriptions={subscriptions} />}
          </>
        )}
      </div>
    </div>
  )
}

function CustomerList({
  customers,
  selectedId,
  onSelect
}: {
  customers: { id: string; email: string | null; name: string | null }[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}): React.JSX.Element {
  if (customers.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-[var(--cos-text-muted)]">
        No customers found. Click Sync to import from Stripe.
      </div>
    )
  }

  return (
    <div className="p-2 space-y-1">
      {customers.map((c) => (
        <div
          key={c.id}
          onClick={() => onSelect(c.id === selectedId ? null : c.id)}
          className={`p-2 rounded cursor-pointer transition-colors ${
            c.id === selectedId
              ? 'bg-indigo-600/15 border border-indigo-500/40'
              : 'bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] hover:border-[var(--cos-border-light)]'
          }`}
        >
          <p className="text-sm font-medium truncate">{c.name || 'Unnamed'}</p>
          <p className="text-xs text-[var(--cos-text-muted)] truncate">{c.email || 'No email'}</p>
        </div>
      ))}
    </div>
  )
}

function PaymentList({
  payments
}: {
  payments: {
    id: string
    amount: number
    currency: string
    status: string
    customer_id: string | null
  }[]
}): React.JSX.Element {
  if (payments.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-[var(--cos-text-muted)]">
        No payments found. Click Sync to import from Stripe.
      </div>
    )
  }

  const formatAmount = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100)
  }

  const statusVariant = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'succeeded':
        return 'success'
      case 'processing':
        return 'warning'
      case 'canceled':
      case 'requires_payment_method':
        return 'error'
      default:
        return 'default'
    }
  }

  return (
    <div className="p-2 space-y-1">
      {payments.map((p) => (
        <div
          key={p.id}
          className="p-2 rounded bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)]"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{formatAmount(p.amount, p.currency)}</p>
            <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
          </div>
          <p className="text-xs text-[var(--cos-text-muted)] truncate mt-0.5">
            {p.id.slice(0, 20)}...
          </p>
        </div>
      ))}
    </div>
  )
}

function SubscriptionList({
  subscriptions
}: {
  subscriptions: {
    id: string
    status: string
    customer_id: string
    current_period_end: string | null
  }[]
}): React.JSX.Element {
  if (subscriptions.length === 0) {
    return (
      <div className="p-3 text-center text-xs text-[var(--cos-text-muted)]">
        No subscriptions found. Click Sync to import from Stripe.
      </div>
    )
  }

  const statusVariant = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'active':
        return 'success'
      case 'past_due':
        return 'warning'
      case 'canceled':
      case 'unpaid':
        return 'error'
      default:
        return 'default'
    }
  }

  return (
    <div className="p-2 space-y-1">
      {subscriptions.map((s) => (
        <div
          key={s.id}
          className="p-2 rounded bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)]"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--cos-text-muted)] truncate">{s.id.slice(0, 16)}...</p>
            <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
          </div>
          {s.current_period_end && (
            <p className="text-xs text-[var(--cos-text-muted)] mt-0.5">
              Ends: {new Date(s.current_period_end).toLocaleDateString()}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
