// ============================================================================
// ext-deal-analyzer — Deal Comparer
//
// Side-by-side comparison of multiple deals
// ============================================================================

import type { DealRow } from '../db/deals-repo'
import {
  analyzeDeal,
  type DealMetrics,
  formatCurrency,
  formatPercent,
  formatRatio
} from './deal-analyzer'

export interface DealComparison {
  deals: Array<{
    id: string
    address: string
    city: string
    state: string
    metrics: DealMetrics
  }>
  comparison: {
    bestCapRate: string
    bestCashOnCash: string
    bestCashFlow: string
    bestDscr: string
    lowestInvestment: string
    highestRoi: string | null
  }
  summary: string
}

export function compareDeals(
  deals: DealRow[],
  additionalExpenses: Record<string, number> = {}
): DealComparison {
  if (deals.length < 2) {
    throw new Error('Need at least 2 deals to compare')
  }

  const analyzed = deals.map((deal) => ({
    id: deal.id,
    address: deal.address,
    city: deal.city,
    state: deal.state,
    metrics: analyzeDeal(deal, additionalExpenses[deal.id] ?? 0)
  }))

  // Find best in each category
  let bestCapRate = analyzed[0]
  let bestCashOnCash = analyzed[0]
  let bestCashFlow = analyzed[0]
  let bestDscr = analyzed[0]
  let lowestInvestment = analyzed[0]
  let highestRoi: (typeof analyzed)[0] | null = null

  for (const deal of analyzed) {
    if (deal.metrics.capRate > bestCapRate.metrics.capRate) {
      bestCapRate = deal
    }
    if (deal.metrics.cashOnCash > bestCashOnCash.metrics.cashOnCash) {
      bestCashOnCash = deal
    }
    if (deal.metrics.monthlyCashFlow > bestCashFlow.metrics.monthlyCashFlow) {
      bestCashFlow = deal
    }
    if (deal.metrics.dscr > bestDscr.metrics.dscr) {
      bestDscr = deal
    }
    if (deal.metrics.totalInvestment < lowestInvestment.metrics.totalInvestment) {
      lowestInvestment = deal
    }
    if (deal.metrics.roi !== null) {
      if (!highestRoi || (deal.metrics.roi ?? 0) > (highestRoi.metrics.roi ?? 0)) {
        highestRoi = deal
      }
    }
  }

  // Generate summary
  const summaryParts: string[] = []

  summaryParts.push(`Comparing ${analyzed.length} deals:`)
  summaryParts.push(
    `- Best Cap Rate: ${bestCapRate.address} (${formatPercent(bestCapRate.metrics.capRate)})`
  )
  summaryParts.push(
    `- Best Cash-on-Cash: ${bestCashOnCash.address} (${formatPercent(bestCashOnCash.metrics.cashOnCash)})`
  )
  summaryParts.push(
    `- Best Cash Flow: ${bestCashFlow.address} (${formatCurrency(bestCashFlow.metrics.monthlyCashFlow)}/mo)`
  )
  summaryParts.push(`- Best DSCR: ${bestDscr.address} (${formatRatio(bestDscr.metrics.dscr)})`)
  summaryParts.push(
    `- Lowest Investment: ${lowestInvestment.address} (${formatCurrency(lowestInvestment.metrics.totalInvestment)})`
  )

  if (highestRoi && highestRoi.metrics.roi !== null) {
    summaryParts.push(
      `- Highest ROI (flip): ${highestRoi.address} (${formatPercent(highestRoi.metrics.roi)})`
    )
  }

  return {
    deals: analyzed,
    comparison: {
      bestCapRate: bestCapRate.id,
      bestCashOnCash: bestCashOnCash.id,
      bestCashFlow: bestCashFlow.id,
      bestDscr: bestDscr.id,
      lowestInvestment: lowestInvestment.id,
      highestRoi: highestRoi?.id ?? null
    },
    summary: summaryParts.join('\n')
  }
}
