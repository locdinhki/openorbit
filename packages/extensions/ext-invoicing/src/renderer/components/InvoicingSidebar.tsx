import { useState, useEffect } from 'react'
import { useExtInvoicingStore } from '../store/index'
import Button from '@renderer/components/shared/Button'
import Badge from '@renderer/components/shared/Badge'

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'overdue' | 'void'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' }
]

export default function InvoicingSidebar(): React.JSX.Element {
  const [showNewInvoice, setShowNewInvoice] = useState(false)

  const {
    invoices,
    selectedInvoice,
    stats,
    statusFilter,
    loading,
    loadInvoices,
    loadStats,
    selectInvoice,
    setStatusFilter
  } = useExtInvoicingStore()

  useEffect(() => {
    loadInvoices()
    loadStats()
  }, [loadInvoices, loadStats])

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const statusVariant = (status: string): 'success' | 'warning' | 'error' | 'default' | 'info' => {
    switch (status) {
      case 'paid':
        return 'success'
      case 'sent':
        return 'info'
      case 'overdue':
        return 'error'
      case 'void':
        return 'error'
      default:
        return 'default'
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--cos-border)]">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">Invoices</span>
        <Button size="sm" variant="primary" onClick={() => setShowNewInvoice(true)}>
          + New
        </Button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="px-3 py-2 border-b border-[var(--cos-border)] bg-[var(--cos-bg-tertiary)]">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[var(--cos-text-muted)]">Outstanding</span>
              <p className="font-medium text-[var(--cos-text-primary)]">
                {formatCurrency(stats.totalOutstanding)}
              </p>
            </div>
            <div>
              <span className="text-[var(--cos-text-muted)]">Overdue</span>
              <p className="font-medium text-red-400">{formatCurrency(stats.overdueAmount)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-[var(--cos-border)]">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setStatusFilter(filter.key)}
            className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors cursor-pointer ${
              statusFilter === filter.key
                ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                : 'bg-transparent border-[var(--cos-border)] text-[var(--cos-text-muted)] hover:border-[var(--cos-border-light)]'
            }`}
          >
            {filter.label}
            {filter.key !== 'all' && stats && (
              <span className="ml-1">
                {filter.key === 'draft' && stats.draftCount}
                {filter.key === 'sent' && stats.sentCount}
                {filter.key === 'paid' && stats.paidCount}
                {filter.key === 'overdue' && stats.overdueCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="text-center py-4 text-xs text-[var(--cos-text-muted)]">Loading...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-[var(--cos-text-muted)]">No invoices found</p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setShowNewInvoice(true)}
            >
              Create your first invoice
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                onClick={() =>
                  selectInvoice(invoice.id === selectedInvoice?.id ? null : invoice.id)
                }
                className={`p-2 rounded cursor-pointer transition-colors ${
                  invoice.id === selectedInvoice?.id
                    ? 'bg-indigo-600/15 border border-indigo-500/40'
                    : 'bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] hover:border-[var(--cos-border-light)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--cos-text-muted)]">
                      {invoice.invoice_number}
                    </p>
                    <p className="text-sm font-medium truncate">{invoice.customer_name}</p>
                  </div>
                  <p className="text-sm font-medium whitespace-nowrap">
                    {formatCurrency(invoice.total)}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge>
                  {invoice.due_date && (
                    <span className="text-[10px] text-[var(--cos-text-muted)]">
                      Due: {new Date(invoice.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Invoice Modal would go here */}
      {showNewInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--cos-bg-secondary)] rounded-lg p-4 w-96 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium">New Invoice</h2>
              <button
                onClick={() => setShowNewInvoice(false)}
                className="text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)]"
              >
                &times;
              </button>
            </div>
            <p className="text-xs text-[var(--cos-text-muted)]">
              Use the workspace to create a new invoice with full editing capabilities.
            </p>
            <div className="flex justify-end mt-4">
              <Button size="sm" variant="ghost" onClick={() => setShowNewInvoice(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
