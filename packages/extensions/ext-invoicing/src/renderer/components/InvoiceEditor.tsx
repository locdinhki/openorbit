import { useState } from 'react'
import { useExtInvoicingStore } from '../store/index'
import type { InvoiceWithItems, InvoiceItemInput, CustomerInput } from '../lib/ipc-client'
import Button from '@renderer/components/shared/Button'

interface Props {
  invoice?: InvoiceWithItems | null
  onBack: () => void
}

export default function InvoiceEditor({ invoice, onBack }: Props): React.JSX.Element {
  const { createInvoice, updateInvoice, saving } = useExtInvoicingStore()

  const [customer, setCustomer] = useState<CustomerInput>({
    name: invoice?.customer_name ?? '',
    email: invoice?.customer_email ?? '',
    address: invoice?.customer_address ?? '',
    phone: invoice?.customer_phone ?? ''
  })

  const [items, setItems] = useState<InvoiceItemInput[]>(
    invoice?.items?.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unit_price
    })) ?? [{ description: '', quantity: 1, unitPrice: 0 }]
  )

  const [taxRate, setTaxRate] = useState(invoice?.tax_rate ?? 0)
  const [notes, setNotes] = useState(invoice?.notes ?? '')
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? '')

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total = subtotal + taxAmount

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const addItem = (): void => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0 }])
  }

  const removeItem = (index: number): void => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (
    index: number,
    field: keyof InvoiceItemInput,
    value: string | number
  ): void => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleSave = async (): Promise<void> => {
    if (!customer.name || !customer.email || items.length === 0) {
      return
    }

    const validItems = items.filter((i) => i.description && i.quantity > 0)
    if (validItems.length === 0) return

    if (invoice) {
      await updateInvoice(invoice.id, {
        customer,
        items: validItems,
        taxRate,
        dueDate: dueDate || undefined,
        notes: notes || undefined
      })
    } else {
      await createInvoice({
        customer,
        items: validItems,
        taxRate,
        dueDate: dueDate || undefined,
        notes: notes || undefined
      })
    }
    onBack()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--cos-border)]">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onBack}>
            &larr; Cancel
          </Button>
          <span className="text-sm font-medium">
            {invoice ? `Edit ${invoice.invoice_number}` : 'New Invoice'}
          </span>
        </div>
        <Button size="sm" variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : invoice ? 'Update Invoice' : 'Create Invoice'}
        </Button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Customer Info */}
        <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
          <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider mb-3">
            Customer
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Customer Name *"
              value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              className="px-2 py-1.5 text-sm bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
            />
            <input
              type="email"
              placeholder="Email *"
              value={customer.email}
              onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
              className="px-2 py-1.5 text-sm bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Address"
              value={customer.address}
              onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
              className="px-2 py-1.5 text-sm bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Phone"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              className="px-2 py-1.5 text-sm bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider">
              Items
            </h3>
            <Button size="sm" variant="ghost" onClick={addItem}>
              + Add Item
            </Button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateItem(index, 'description', e.target.value)}
                  className="flex-1 px-2 py-1.5 text-sm bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-1.5 text-sm bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] text-right focus:outline-none focus:border-indigo-500"
                  min="0"
                  step="1"
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1.5 text-sm bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] text-right focus:outline-none focus:border-indigo-500"
                  min="0"
                  step="0.01"
                />
                <span className="w-24 text-sm text-right text-[var(--cos-text-secondary)]">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </span>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(index)}
                    className="text-red-400 hover:text-red-300 text-sm cursor-pointer"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
            <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider mb-3">
              Details
            </h3>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-[var(--cos-text-muted)]">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--cos-text-muted)]">Tax Rate (%)</label>
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
            <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider mb-3">
              Totals
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--cos-text-muted)]">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--cos-text-muted)]">Tax ({taxRate}%)</span>
                  <span>{formatCurrency(taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium pt-2 border-t border-[var(--cos-border)]">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-lg p-4">
          <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2">
            Notes
          </h3>
          <textarea
            placeholder="Additional notes or terms..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>
      </div>
    </div>
  )
}
