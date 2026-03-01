// ============================================================================
// ext-deal-analyzer — Workspace Router Component
// ============================================================================

import type React from 'react'
import { useStore } from '../store'
import DealForm, { type DealFormData } from './DealForm'
import MetricsGrid from './MetricsGrid'
import CompsTable from './CompsTable'
import ExpensesTable from './ExpensesTable'
import CompareView from './CompareView'

export default function DealWorkspace(): React.JSX.Element {
  const {
    view,
    setView,
    deals,
    selectedDealId,
    selectDeal,
    analysis,
    analysisLoading,
    comps,
    expenses,
    comparison,
    formMode,
    setFormMode,
    createDeal,
    updateDeal,
    deleteDeal,
    deleteComp,
    deleteExpense,
    exportPdf,
    exporting,
    clearComparison
  } = useStore()

  const selectedDeal = deals.find((d) => d.id === selectedDealId)

  // Form view
  if (view === 'form') {
    const handleSubmit = async (data: DealFormData): Promise<void> => {
      if (formMode === 'create') {
        const deal = await createDeal(data)
        if (deal) {
          selectDeal(deal.id)
          setView('detail')
        }
      } else if (selectedDeal) {
        await updateDeal({ id: selectedDeal.id, ...data })
        setView('detail')
      }
    }

    return (
      <div className="h-full overflow-y-auto p-6 bg-zinc-900">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-zinc-100 mb-6">
            {formMode === 'create' ? 'New Deal' : 'Edit Deal'}
          </h2>
          <DealForm
            deal={formMode === 'edit' ? selectedDeal : undefined}
            onSubmit={handleSubmit}
            onCancel={() => setView(selectedDeal ? 'detail' : 'list')}
          />
        </div>
      </div>
    )
  }

  // Compare view
  if (view === 'compare' && comparison) {
    return (
      <div className="h-full overflow-y-auto bg-zinc-900">
        <CompareView
          comparison={comparison}
          onClose={() => {
            clearComparison()
            setView('list')
          }}
        />
      </div>
    )
  }

  // Detail view
  if (view === 'detail' && selectedDeal) {
    return (
      <div className="h-full overflow-y-auto bg-zinc-900">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">{selectedDeal.address}</h2>
              <p className="text-zinc-400">
                {selectedDeal.city}, {selectedDeal.state} {selectedDeal.postalCode}
              </p>
              <p className="text-sm text-zinc-500 capitalize mt-1">
                {selectedDeal.propertyType.replace('-', ' ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFormMode('edit')
                  setView('form')
                }}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => exportPdf(selectedDeal.id)}
                disabled={exporting}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
              <button
                onClick={async () => {
                  if (confirm('Delete this deal?')) {
                    await deleteDeal(selectedDeal.id)
                    setView('list')
                  }
                }}
                className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 border border-red-700/50 rounded-lg hover:border-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div>
            {analysisLoading ? (
              <div className="py-8 text-center text-zinc-500">Analyzing...</div>
            ) : analysis ? (
              <MetricsGrid metrics={analysis.metrics} />
            ) : (
              <div className="py-8 text-center text-zinc-500">No analysis available</div>
            )}
          </div>

          {/* Comparable Sales */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Comparable Sales ({comps.length})
            </h3>
            <CompsTable
              comps={comps}
              onDelete={deleteComp}
              averagePrice={analysis?.compsAveragePrice}
            />
          </div>

          {/* Additional Expenses */}
          <div>
            <h3 className="text-sm font-medium text-zinc-300 mb-3">
              Additional Expenses ({expenses.length})
            </h3>
            <ExpensesTable expenses={expenses} onDelete={deleteExpense} />
          </div>

          {/* Notes */}
          {selectedDeal.notes && (
            <div>
              <h3 className="text-sm font-medium text-zinc-300 mb-2">Notes</h3>
              <p className="text-sm text-zinc-400 bg-zinc-800/50 p-3 rounded-lg whitespace-pre-wrap">
                {selectedDeal.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // List view (empty state)
  return (
    <div className="h-full flex items-center justify-center bg-zinc-900">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-zinc-300 mb-1">Deal Analyzer</h3>
        <p className="text-sm text-zinc-500 mb-4">
          Select a deal from the sidebar to view analysis
        </p>
        <button
          onClick={() => {
            setFormMode('create')
            setView('form')
          }}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create New Deal
        </button>
      </div>
    </div>
  )
}
