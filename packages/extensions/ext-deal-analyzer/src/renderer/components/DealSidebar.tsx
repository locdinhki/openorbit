// ============================================================================
// ext-deal-analyzer — Sidebar Component
// ============================================================================

import type React from 'react'
import { useEffect } from 'react'
import { useStore } from '../store'
import DealCard from './DealCard'

export default function DealSidebar(): React.JSX.Element {
  const {
    deals,
    dealsLoading,
    loadDeals,
    selectedDealId,
    selectDeal,
    setView,
    setFormMode,
    compareIds,
    toggleCompareId,
    compareDeals,
    compareLoading
  } = useStore()

  useEffect(() => {
    loadDeals()
  }, [loadDeals])

  const handleNewDeal = (): void => {
    selectDeal(null)
    setFormMode('create')
    setView('form')
  }

  const handleCompare = (): void => {
    if (compareIds.length >= 2) {
      compareDeals(compareIds)
      setView('compare')
    }
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-zinc-200">Deal Analyzer</h2>
          <button
            onClick={handleNewDeal}
            className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            title="New Deal"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {/* Compare button */}
        {compareIds.length >= 2 && (
          <button
            onClick={handleCompare}
            disabled={compareLoading}
            className="w-full py-2 px-3 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {compareLoading ? (
              'Comparing...'
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                  />
                </svg>
                Compare {compareIds.length} Deals
              </>
            )}
          </button>
        )}
      </div>

      {/* Deal List */}
      <div className="flex-1 overflow-y-auto p-3">
        {dealsLoading ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
            Loading deals...
          </div>
        ) : deals.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-500 text-sm mb-3">No deals yet</p>
            <button
              onClick={handleNewDeal}
              className="text-blue-400 text-sm hover:text-blue-300 transition-colors"
            >
              Create your first deal
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                selected={deal.id === selectedDealId}
                comparing={compareIds.includes(deal.id)}
                onSelect={() => {
                  selectDeal(deal.id)
                  setView('detail')
                }}
                onToggleCompare={() => toggleCompareId(deal.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>
            {deals.length} deal{deals.length !== 1 ? 's' : ''}
          </span>
          {compareIds.length > 0 && (
            <button
              onClick={() => useStore.getState().clearCompareIds()}
              className="text-zinc-400 hover:text-zinc-300"
            >
              Clear selection
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
