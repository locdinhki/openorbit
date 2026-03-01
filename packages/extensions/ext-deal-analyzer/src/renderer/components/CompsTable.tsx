// ============================================================================
// ext-deal-analyzer — Comparable Sales Table Component
// ============================================================================

import type React from 'react'
import type { DealCompRow } from '../lib/ipc-client'

interface CompsTableProps {
  comps: DealCompRow[]
  onDelete?: (id: string) => void
  averagePrice?: number | null
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function CompsTable({
  comps,
  onDelete,
  averagePrice
}: CompsTableProps): React.JSX.Element {
  if (comps.length === 0) {
    return (
      <div className="p-4 text-center text-zinc-500 text-sm">No comparable sales added yet.</div>
    )
  }

  return (
    <div className="space-y-2">
      {averagePrice && (
        <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <span className="text-xs text-blue-400 uppercase tracking-wide">Average Comp Price:</span>
          <span className="ml-2 font-semibold text-blue-300">{formatCurrency(averagePrice)}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide">
              <th className="pb-2 pr-4">Address</th>
              <th className="pb-2 pr-4">Sale Price</th>
              <th className="pb-2 pr-4">Sq Ft</th>
              <th className="pb-2 pr-4">Bed/Bath</th>
              <th className="pb-2 pr-4">Date</th>
              {onDelete && <th className="pb-2 w-8"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-700/50">
            {comps.map((comp) => (
              <tr key={comp.id} className="hover:bg-zinc-800/30">
                <td className="py-2 pr-4">
                  <div>
                    <p className="text-zinc-200 truncate max-w-[200px]">{comp.address}</p>
                    <p className="text-xs text-zinc-500">
                      {comp.city}, {comp.state}
                    </p>
                  </div>
                </td>
                <td className="py-2 pr-4 text-zinc-200">{formatCurrency(comp.salePrice)}</td>
                <td className="py-2 pr-4 text-zinc-400">
                  {comp.squareFeet?.toLocaleString() ?? '-'}
                </td>
                <td className="py-2 pr-4 text-zinc-400">
                  {comp.bedrooms ?? '-'}/{comp.bathrooms ?? '-'}
                </td>
                <td className="py-2 pr-4 text-zinc-500">{comp.saleDate ?? '-'}</td>
                {onDelete && (
                  <td className="py-2">
                    <button
                      onClick={() => onDelete(comp.id)}
                      className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete comp"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
