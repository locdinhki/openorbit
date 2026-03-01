// ============================================================================
// ext-deal-analyzer — Deal Card Component
// ============================================================================

import type React from 'react'
import type { DealRow } from '../lib/ipc-client'

interface DealCardProps {
  deal: DealRow
  selected?: boolean
  comparing?: boolean
  onSelect: () => void
  onToggleCompare?: () => void
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function DealCard({
  deal,
  selected,
  comparing,
  onSelect,
  onToggleCompare
}: DealCardProps): React.JSX.Element {
  return (
    <div
      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
        selected
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-zinc-100 truncate">{deal.address}</p>
          <p className="text-sm text-zinc-400">
            {deal.city}, {deal.state} {deal.postalCode}
          </p>
        </div>
        {onToggleCompare && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleCompare()
            }}
            className={`p-1.5 rounded transition-colors ${
              comparing
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-zinc-700/50 text-zinc-400 hover:text-zinc-300'
            }`}
            title={comparing ? 'Remove from comparison' : 'Add to comparison'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-sm">
        <span className="text-zinc-300">{formatCurrency(deal.purchasePrice)}</span>
        <span className="text-zinc-500">|</span>
        <span className="text-zinc-400 capitalize">{deal.propertyType.replace('-', ' ')}</span>
        {deal.status === 'archived' && (
          <>
            <span className="text-zinc-500">|</span>
            <span className="text-yellow-500 text-xs">Archived</span>
          </>
        )}
      </div>

      {deal.estimatedRent && (
        <div className="mt-1 text-xs text-zinc-500">
          Est. Rent: {formatCurrency(deal.estimatedRent)}/mo
        </div>
      )}
    </div>
  )
}
