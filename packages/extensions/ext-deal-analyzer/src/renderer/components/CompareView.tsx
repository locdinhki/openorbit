// ============================================================================
// ext-deal-analyzer — Deal Comparison View Component
// ============================================================================

import type React from 'react'
import type { DealComparison } from '../lib/ipc-client'

interface CompareViewProps {
  comparison: DealComparison
  onClose: () => void
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatRatio(value: number): string {
  return value.toFixed(2)
}

export default function CompareView({ comparison, onClose }: CompareViewProps): React.JSX.Element {
  const { deals, comparison: best } = comparison

  const isBest = (dealId: string, category: keyof typeof best): boolean => {
    return best[category] === dealId
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Deal Comparison</h2>
        <button
          onClick={onClose}
          className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="py-3 px-4 text-left text-xs text-zinc-500 uppercase tracking-wide w-40">
                Metric
              </th>
              {deals.map((deal) => (
                <th key={deal.id} className="py-3 px-4 text-left">
                  <div className="text-zinc-200 font-medium truncate max-w-[150px]">
                    {deal.address}
                  </div>
                  <div className="text-xs text-zinc-500 font-normal">
                    {deal.city}, {deal.state}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            <CompareRow
              label="Cap Rate"
              values={deals.map((d) => ({
                value: formatPercent(d.metrics.capRate),
                isBest: isBest(d.id, 'bestCapRate')
              }))}
            />
            <CompareRow
              label="Cash-on-Cash"
              values={deals.map((d) => ({
                value: formatPercent(d.metrics.cashOnCash),
                isBest: isBest(d.id, 'bestCashOnCash')
              }))}
            />
            <CompareRow
              label="Monthly Cash Flow"
              values={deals.map((d) => ({
                value: formatCurrency(d.metrics.monthlyCashFlow),
                isBest: isBest(d.id, 'bestCashFlow')
              }))}
            />
            <CompareRow
              label="DSCR"
              values={deals.map((d) => ({
                value: formatRatio(d.metrics.dscr),
                isBest: isBest(d.id, 'bestDscr')
              }))}
            />
            <CompareRow
              label="NOI"
              values={deals.map((d) => ({
                value: formatCurrency(d.metrics.noi),
                isBest: false
              }))}
            />
            <CompareRow
              label="Total Investment"
              values={deals.map((d) => ({
                value: formatCurrency(d.metrics.totalInvestment),
                isBest: isBest(d.id, 'lowestInvestment')
              }))}
            />
            <CompareRow
              label="GRM"
              values={deals.map((d) => ({
                value: formatRatio(d.metrics.grm),
                isBest: false
              }))}
            />
            <CompareRow
              label="Break-Even"
              values={deals.map((d) => ({
                value: formatPercent(d.metrics.breakEvenRatio),
                isBest: false
              }))}
            />
            {deals.some((d) => d.metrics.roi !== null) && (
              <CompareRow
                label="ROI (Flip)"
                values={deals.map((d) => ({
                  value: d.metrics.roi !== null ? formatPercent(d.metrics.roi) : '-',
                  isBest: isBest(d.id, 'highestRoi')
                }))}
              />
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 bg-zinc-800/50 rounded-lg">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Summary</h3>
        <pre className="text-sm text-zinc-300 whitespace-pre-wrap">{comparison.summary}</pre>
      </div>
    </div>
  )
}

interface CompareRowProps {
  label: string
  values: Array<{ value: string; isBest: boolean }>
}

function CompareRow({ label, values }: CompareRowProps): React.JSX.Element {
  return (
    <tr className="hover:bg-zinc-800/30">
      <td className="py-3 px-4 text-zinc-400">{label}</td>
      {values.map((v, i) => (
        <td
          key={i}
          className={`py-3 px-4 ${v.isBest ? 'text-green-400 font-semibold' : 'text-zinc-200'}`}
        >
          {v.value}
          {v.isBest && (
            <span className="ml-1 text-green-500">
              <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </td>
      ))}
    </tr>
  )
}
