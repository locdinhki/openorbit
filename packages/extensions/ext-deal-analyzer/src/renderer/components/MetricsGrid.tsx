// ============================================================================
// ext-deal-analyzer — Metrics Grid Component
// ============================================================================

import type React from 'react'
import type { DealMetrics } from '../lib/ipc-client'

interface MetricsGridProps {
  metrics: DealMetrics
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

interface MetricItemProps {
  label: string
  value: string
  sublabel?: string
  highlight?: 'positive' | 'negative' | 'neutral'
}

function MetricItem({ label, value, sublabel, highlight }: MetricItemProps): React.JSX.Element {
  const valueColor =
    highlight === 'positive'
      ? 'text-green-400'
      : highlight === 'negative'
        ? 'text-red-400'
        : 'text-zinc-100'

  return (
    <div className="p-3 bg-zinc-800/50 rounded-lg">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold ${valueColor}`}>{value}</p>
      {sublabel && <p className="text-xs text-zinc-500">{sublabel}</p>}
    </div>
  )
}

export default function MetricsGrid({ metrics }: MetricsGridProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      {/* Key Ratios */}
      <div>
        <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
          Key Metrics
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <MetricItem
            label="Cap Rate"
            value={formatPercent(metrics.capRate)}
            highlight={
              metrics.capRate >= 0.08
                ? 'positive'
                : metrics.capRate >= 0.05
                  ? 'neutral'
                  : 'negative'
            }
          />
          <MetricItem
            label="Cash-on-Cash"
            value={formatPercent(metrics.cashOnCash)}
            highlight={
              metrics.cashOnCash >= 0.08
                ? 'positive'
                : metrics.cashOnCash >= 0.05
                  ? 'neutral'
                  : 'negative'
            }
          />
          <MetricItem
            label="DSCR"
            value={formatRatio(metrics.dscr)}
            highlight={
              metrics.dscr >= 1.25 ? 'positive' : metrics.dscr >= 1.0 ? 'neutral' : 'negative'
            }
          />
          <MetricItem
            label="GRM"
            value={formatRatio(metrics.grm)}
            highlight={metrics.grm <= 12 ? 'positive' : metrics.grm <= 15 ? 'neutral' : 'negative'}
          />
        </div>
      </div>

      {/* Cash Flow */}
      <div>
        <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
          Cash Flow
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <MetricItem
            label="Monthly Cash Flow"
            value={formatCurrency(metrics.monthlyCashFlow)}
            highlight={metrics.monthlyCashFlow > 0 ? 'positive' : 'negative'}
          />
          <MetricItem
            label="Annual Cash Flow"
            value={formatCurrency(metrics.annualCashFlow)}
            highlight={metrics.annualCashFlow > 0 ? 'positive' : 'negative'}
          />
          <MetricItem label="NOI" value={formatCurrency(metrics.noi)} sublabel="per year" />
          <MetricItem
            label="Break-Even"
            value={formatPercent(metrics.breakEvenRatio)}
            highlight={
              metrics.breakEvenRatio <= 0.85
                ? 'positive'
                : metrics.breakEvenRatio <= 0.95
                  ? 'neutral'
                  : 'negative'
            }
          />
        </div>
      </div>

      {/* Investment */}
      <div>
        <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
          Investment
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <MetricItem label="Total Investment" value={formatCurrency(metrics.totalInvestment)} />
          <MetricItem label="Down Payment" value={formatCurrency(metrics.downPayment)} />
          <MetricItem label="Loan Amount" value={formatCurrency(metrics.loanAmount)} />
          <MetricItem
            label="Monthly Mortgage"
            value={formatCurrency(metrics.monthlyMortgage)}
            sublabel="P&I"
          />
        </div>
      </div>

      {/* Flip Analysis (if applicable) */}
      {metrics.roi !== null && (
        <div>
          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
            Flip Analysis
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <MetricItem
              label="Equity Gain"
              value={formatCurrency(metrics.equityGain ?? 0)}
              highlight={(metrics.equityGain ?? 0) > 0 ? 'positive' : 'negative'}
            />
            <MetricItem
              label="ROI"
              value={formatPercent(metrics.roi)}
              highlight={
                metrics.roi >= 0.2 ? 'positive' : metrics.roi >= 0.1 ? 'neutral' : 'negative'
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
