import { useEffect, useState } from 'react'
import { useExtInvoicingStore } from '../store/index'
import InvoiceEditor from './InvoiceEditor'
import InvoicePreview from './InvoicePreview'
import Button from '@renderer/components/shared/Button'
import Badge from '@renderer/components/shared/Badge'

type View = 'dashboard' | 'editor' | 'preview'

export default function InvoicingWorkspace(): React.JSX.Element {
  const [view, setView] = useState<View>('dashboard')
  const { selectedInvoice, stats, loadStats, sendInvoice, markPaid, createPaymentLink } =
    useExtInvoicingStore()

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    if (selectedInvoice) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView('preview')
    }
  }, [selectedInvoice])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (view === 'editor') {
    return (
      <InvoiceEditor
        invoice={selectedInvoice}
        onBack={() => setView(selectedInvoice ? 'preview' : 'dashboard')}
      />
    )
  }

  if (view === 'preview' && selectedInvoice) {
    return (
      <div className="flex flex-col h-full">
        {/* Actions Bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--cos-border)]">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setView('dashboard')}>
              &larr; Back
            </Button>
            <span className="text-sm font-medium">{selectedInvoice.invoice_number}</span>
            <Badge
              variant={
                selectedInvoice.status === 'paid'
                  ? 'success'
                  : selectedInvoice.status === 'overdue'
                    ? 'error'
                    : 'default'
              }
            >
              {selectedInvoice.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {selectedInvoice.status === 'draft' && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setView('editor')}>
                  Edit
                </Button>
                <Button size="sm" variant="primary" onClick={() => sendInvoice(selectedInvoice.id)}>
                  Send Invoice
                </Button>
              </>
            )}
            {selectedInvoice.status === 'sent' && (
              <>
                {!selectedInvoice.stripe_payment_link_url && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => createPaymentLink(selectedInvoice.id)}
                  >
                    Create Payment Link
                  </Button>
                )}
                <Button size="sm" variant="primary" onClick={() => markPaid(selectedInvoice.id)}>
                  Mark as Paid
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Invoice Preview */}
        <div className="flex-1 overflow-y-auto">
          <InvoicePreview invoice={selectedInvoice} />
        </div>
      </div>
    )
  }

  // Dashboard View
  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--cos-text-primary)]">Invoicing</h1>
          <p className="text-sm text-[var(--cos-text-muted)]">Manage your invoices and payments</p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setView('editor')}>
          + Create Invoice
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Outstanding"
            value={formatCurrency(stats.totalOutstanding)}
            description={`${stats.sentCount} invoices`}
          />
          <StatCard
            label="Overdue"
            value={formatCurrency(stats.overdueAmount)}
            description={`${stats.overdueCount} invoices`}
            variant="error"
          />
          <StatCard
            label="Total Paid"
            value={formatCurrency(stats.totalPaid)}
            description={`${stats.paidCount} invoices`}
            variant="success"
          />
          <StatCard label="Drafts" value={String(stats.draftCount)} description="Pending send" />
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
        <h2 className="text-sm font-medium text-[var(--cos-text-primary)] mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setView('editor')}>
            New Invoice
          </Button>
          <Button size="sm" variant="ghost" disabled>
            View Recurring
          </Button>
          <Button size="sm" variant="ghost" disabled>
            View Payments
          </Button>
        </div>
      </div>

      {/* Recent Activity */}
      {stats && stats.recurringCount > 0 && (
        <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
          <h2 className="text-sm font-medium text-[var(--cos-text-primary)] mb-2">
            Recurring Invoices
          </h2>
          <p className="text-xs text-[var(--cos-text-muted)]">
            {stats.recurringCount} recurring invoice{stats.recurringCount !== 1 ? 's' : ''}{' '}
            configured
            {stats.upcomingRecurring > 0 && (
              <span className="text-indigo-400"> ({stats.upcomingRecurring} due this week)</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  description,
  variant = 'default'
}: {
  label: string
  value: string
  description: string
  variant?: 'default' | 'success' | 'error'
}): React.JSX.Element {
  const valueColor =
    variant === 'success'
      ? 'text-green-400'
      : variant === 'error'
        ? 'text-red-400'
        : 'text-[var(--cos-text-primary)]'

  return (
    <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
      <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider mb-1">
        {label}
      </h3>
      <p className={`text-xl font-semibold ${valueColor}`}>{value}</p>
      <p className="text-xs text-[var(--cos-text-muted)]">{description}</p>
    </div>
  )
}
