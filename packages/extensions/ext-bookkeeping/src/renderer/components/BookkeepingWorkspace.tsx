import { useState, useEffect } from 'react'
import { useExtBookkeepingStore } from '../store/index'
import TransactionList from './TransactionList'
import ProfitLossReport from './reports/ProfitLossReport'
import Button from '@renderer/components/shared/Button'

type View = 'transactions' | 'profit-loss' | 'add-transaction'

export default function BookkeepingWorkspace(): React.JSX.Element {
  const [view, setView] = useState<View>('transactions')
  const {
    accounts,
    categories,
    profitLossReport,
    loadProfitLoss,
    categorizing,
    aiCategorizeUncategorized
  } = useExtBookkeepingStore()

  // Load P&L report for current year by default
  useEffect(() => {
    const now = new Date()
    const startDate = `${now.getFullYear()}-01-01`
    const endDate = now.toISOString().split('T')[0]
    loadProfitLoss(startDate, endDate)
  }, [loadProfitLoss])

  const handleAiCategorize = async (): Promise<void> => {
    const result = await aiCategorizeUncategorized()
    if (result) {
      alert(`AI categorized ${result.processed} transactions`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--cos-border)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('transactions')}
            className={`px-3 py-1 text-sm rounded cursor-pointer transition-colors ${
              view === 'transactions'
                ? 'bg-indigo-600 text-white'
                : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)]'
            }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setView('profit-loss')}
            className={`px-3 py-1 text-sm rounded cursor-pointer transition-colors ${
              view === 'profit-loss'
                ? 'bg-indigo-600 text-white'
                : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)]'
            }`}
          >
            P&L Report
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleAiCategorize} disabled={categorizing}>
            {categorizing ? 'Categorizing...' : 'AI Categorize'}
          </Button>
          <Button size="sm" variant="primary" onClick={() => setView('add-transaction')}>
            + Add Transaction
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'transactions' && <TransactionList />}
        {view === 'profit-loss' && profitLossReport && (
          <ProfitLossReport report={profitLossReport} />
        )}
        {view === 'add-transaction' && (
          <AddTransactionForm
            accounts={accounts}
            categories={categories}
            onClose={() => setView('transactions')}
          />
        )}
      </div>
    </div>
  )
}

function AddTransactionForm({
  accounts,
  categories,
  onClose
}: {
  accounts: { id: string; name: string }[]
  categories: { id: string; name: string; type: string }[]
  onClose: () => void
}): React.JSX.Element {
  const { createTransaction } = useExtBookkeepingStore()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [payee, setPayee] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState('')
  const [isExpense, setIsExpense] = useState(true)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (): Promise<void> => {
    if (!date || !amount || !description || !accountId) return

    setSaving(true)
    const numAmount = parseFloat(amount) * (isExpense ? -1 : 1)

    const success = await createTransaction({
      date,
      amount: numAmount,
      description,
      payee: payee || undefined,
      accountId,
      categoryId: categoryId || undefined
    })

    setSaving(false)
    if (success) {
      onClose()
    }
  }

  const filteredCategories = categories.filter((c) =>
    isExpense ? c.type === 'expense' : c.type === 'income'
  )

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Add Transaction</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <div className="space-y-4">
        {/* Type Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsExpense(true)}
            className={`flex-1 py-2 text-sm rounded cursor-pointer ${
              isExpense
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] text-[var(--cos-text-muted)]'
            }`}
          >
            Expense
          </button>
          <button
            onClick={() => setIsExpense(false)}
            className={`flex-1 py-2 text-sm rounded cursor-pointer ${
              !isExpense
                ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                : 'bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] text-[var(--cos-text-muted)]'
            }`}
          >
            Income
          </button>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs text-[var(--cos-text-muted)] mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs text-[var(--cos-text-muted)] mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs text-[var(--cos-text-muted)] mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this for?"
            className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Payee */}
        <div>
          <label className="block text-xs text-[var(--cos-text-muted)] mb-1">
            Payee (optional)
          </label>
          <input
            type="text"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            placeholder="Who did you pay/receive from?"
            className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Account */}
        <div>
          <label className="block text-xs text-[var(--cos-text-muted)] mb-1">Account</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs text-[var(--cos-text-muted)] mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
          >
            <option value="">Uncategorized</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={saving || !date || !amount || !description || !accountId}
          className="w-full"
        >
          {saving ? 'Saving...' : 'Add Transaction'}
        </Button>
      </div>
    </div>
  )
}
