import type { InvoiceWithItems } from '../lib/ipc-client'
import Badge from '@renderer/components/shared/Badge'

interface Props {
  invoice: InvoiceWithItems
}

export default function InvoicePreview({ invoice }: Props): React.JSX.Element {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const amountDue = invoice.total - invoice.amount_paid

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--cos-text-primary)]">INVOICE</h1>
          <p className="text-sm text-[var(--cos-text-muted)]">{invoice.invoice_number}</p>
        </div>
        <div className="text-right">
          <Badge
            variant={
              invoice.status === 'paid'
                ? 'success'
                : invoice.status === 'overdue'
                  ? 'error'
                  : invoice.status === 'sent'
                    ? 'info'
                    : 'default'
            }
          >
            {invoice.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Addresses */}
      <div className="grid grid-cols-3 gap-6">
        <div>
          <h3 className="text-xs font-medium text-[var(--cos-text-muted)] uppercase mb-2">
            Bill To
          </h3>
          <p className="text-sm font-medium">{invoice.customer_name}</p>
          <p className="text-sm text-[var(--cos-text-secondary)]">{invoice.customer_email}</p>
          {invoice.customer_address && (
            <p className="text-sm text-[var(--cos-text-secondary)]">{invoice.customer_address}</p>
          )}
          {invoice.customer_phone && (
            <p className="text-sm text-[var(--cos-text-secondary)]">{invoice.customer_phone}</p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-medium text-[var(--cos-text-muted)] uppercase mb-2">
            Invoice Date
          </h3>
          <p className="text-sm">{formatDate(invoice.created_at)}</p>
          {invoice.sent_at && (
            <>
              <h3 className="text-xs font-medium text-[var(--cos-text-muted)] uppercase mb-2 mt-4">
                Sent
              </h3>
              <p className="text-sm">{formatDate(invoice.sent_at)}</p>
            </>
          )}
        </div>
        <div>
          <h3 className="text-xs font-medium text-[var(--cos-text-muted)] uppercase mb-2">
            Due Date
          </h3>
          <p className="text-sm">{formatDate(invoice.due_date)}</p>
          {invoice.paid_at && (
            <>
              <h3 className="text-xs font-medium text-[var(--cos-text-muted)] uppercase mb-2 mt-4">
                Paid
              </h3>
              <p className="text-sm text-green-400">{formatDate(invoice.paid_at)}</p>
            </>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-indigo-600">
              <th className="px-4 py-2 text-left text-xs font-medium text-white uppercase">
                Description
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-white uppercase">Qty</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-white uppercase">
                Unit Price
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-white uppercase">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-[var(--cos-border)] last:border-0">
                <td className="px-4 py-3 text-sm">{item.description}</td>
                <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                <td className="px-4 py-3 text-sm text-right">{formatCurrency(item.unit_price)}</td>
                <td className="px-4 py-3 text-sm text-right font-medium">
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--cos-text-muted)]">Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          {invoice.tax_rate > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-[var(--cos-text-muted)]">Tax ({invoice.tax_rate}%)</span>
              <span>{formatCurrency(invoice.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-medium pt-2 border-t border-[var(--cos-border)]">
            <span>Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
          {invoice.amount_paid > 0 && (
            <>
              <div className="flex justify-between text-sm text-green-400">
                <span>Paid</span>
                <span>-{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span>Balance Due</span>
                <span>{formatCurrency(amountDue)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Payment Link */}
      {invoice.stripe_payment_link_url && invoice.status !== 'paid' && (
        <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-lg p-4 text-center">
          <p className="text-sm text-[var(--cos-text-secondary)] mb-2">Pay this invoice online:</p>
          <a
            href={invoice.stripe_payment_link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-500 transition-colors"
          >
            Pay Now
          </a>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
          <h3 className="text-xs font-medium text-[var(--cos-text-muted)] uppercase mb-2">Notes</h3>
          <p className="text-sm text-[var(--cos-text-secondary)] whitespace-pre-wrap">
            {invoice.notes}
          </p>
        </div>
      )}

      {/* Void Notice */}
      {invoice.status === 'void' && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
          <p className="text-sm text-red-400 font-medium">This invoice has been voided</p>
          {invoice.void_reason && (
            <p className="text-xs text-red-400/80 mt-1">Reason: {invoice.void_reason}</p>
          )}
        </div>
      )}
    </div>
  )
}
