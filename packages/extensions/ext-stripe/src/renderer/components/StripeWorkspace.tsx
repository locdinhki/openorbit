import { useEffect } from 'react'
import { useExtStripeStore } from '../store/index'
import Badge from '@renderer/components/shared/Badge'

export default function StripeWorkspace(): React.JSX.Element {
  const { hasSecretKey, metrics, loadMetrics, loadingMetrics, isLiveMode, testConnection } =
    useExtStripeStore()

  useEffect(() => {
    if (hasSecretKey) {
      testConnection()
      loadMetrics()
    }
  }, [hasSecretKey, testConnection, loadMetrics])

  if (!hasSecretKey) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)] text-sm">
        Configure Stripe API key to view dashboard
      </div>
    )
  }

  if (loadingMetrics || !metrics) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)] text-sm">
        Loading metrics...
      </div>
    )
  }

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100)
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--cos-text-primary)]">Stripe Dashboard</h1>
          <p className="text-sm text-[var(--cos-text-muted)]">Payment and subscription metrics</p>
        </div>
        <Badge variant={isLiveMode ? 'success' : 'warning'}>
          {isLiveMode ? 'Live Mode' : 'Test Mode'}
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="MRR"
          value={formatCurrency(metrics.mrr)}
          description="Monthly recurring revenue"
        />
        <MetricCard
          label="Total Revenue"
          value={formatCurrency(metrics.totalRevenue)}
          description="All-time succeeded payments"
        />
        <MetricCard
          label="Active Subscriptions"
          value={metrics.activeSubscriptions.toString()}
          description={`of ${metrics.totalSubscriptions} total`}
        />
        <MetricCard
          label="Customers"
          value={metrics.totalCustomers.toString()}
          description="Total customer accounts"
        />
      </div>

      {/* Period Stats */}
      <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
        <h2 className="text-sm font-medium text-[var(--cos-text-primary)] mb-3">This Period</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-semibold text-[var(--cos-text-primary)]">
              {formatCurrency(metrics.periodRevenue)}
            </p>
            <p className="text-xs text-[var(--cos-text-muted)]">Revenue</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-[var(--cos-text-primary)]">
              {metrics.periodPaymentCount}
            </p>
            <p className="text-xs text-[var(--cos-text-muted)]">Payments</p>
          </div>
        </div>
        <p className="text-xs text-[var(--cos-text-muted)] mt-2">
          {new Date(metrics.startDate).toLocaleDateString()} -{' '}
          {new Date(metrics.endDate).toLocaleDateString()}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
          <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2">
            Payments
          </h3>
          <p className="text-2xl font-semibold text-[var(--cos-text-primary)]">
            {metrics.totalPayments}
          </p>
          <p className="text-xs text-[var(--cos-text-muted)]">Total processed</p>
        </div>
        <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
          <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2">
            Avg Revenue/Customer
          </h3>
          <p className="text-2xl font-semibold text-[var(--cos-text-primary)]">
            {metrics.totalCustomers > 0
              ? formatCurrency(Math.round(metrics.totalRevenue / metrics.totalCustomers))
              : '$0.00'}
          </p>
          <p className="text-xs text-[var(--cos-text-muted)]">Lifetime value</p>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  description
}: {
  label: string
  value: string
  description: string
}): React.JSX.Element {
  return (
    <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
      <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider mb-1">
        {label}
      </h3>
      <p className="text-xl font-semibold text-[var(--cos-text-primary)]">{value}</p>
      <p className="text-xs text-[var(--cos-text-muted)]">{description}</p>
    </div>
  )
}
