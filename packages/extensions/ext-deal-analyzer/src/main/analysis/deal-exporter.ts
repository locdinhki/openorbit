// ============================================================================
// ext-deal-analyzer — Deal PDF Exporter
//
// Generates comprehensive PDF reports for deals
// ============================================================================

import { writeFile, mkdir } from 'fs/promises'
import { dirname, resolve } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import type { DealRow } from '../db/deals-repo'
import type { DealCompRow } from '../db/deal-comps-repo'
import type { DealExpenseRow } from '../db/deal-expenses-repo'
import type { DealMetrics } from './deal-analyzer'
import { formatCurrency, formatPercent, formatRatio } from './deal-analyzer'
import { PdfBuilder, type PdfBlock } from '@openorbit/core/skills/builtin/pdf-builder'

export interface ExportOptions {
  includeComps?: boolean
  includeExpenses?: boolean
  includeCharts?: boolean
  outputPath?: string
}

export interface ExportResult {
  filePath: string
  pageCount: number
  sizeBytes: number
}

export async function exportDealPdf(
  deal: DealRow,
  metrics: DealMetrics,
  comps: DealCompRow[],
  expenses: DealExpenseRow[],
  chartBase64: string | null,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const { includeComps = true, includeExpenses = true, includeCharts = true } = options

  const blocks: PdfBlock[] = []

  // Title
  blocks.push({
    type: 'heading',
    level: 1,
    content: 'Deal Analysis Report'
  })

  // Property Info
  blocks.push({
    type: 'heading',
    level: 2,
    content: 'Property Information'
  })

  blocks.push({
    type: 'key-value',
    columns: 2,
    items: [
      { key: 'Address', value: deal.address },
      { key: 'City', value: `${deal.city}, ${deal.state} ${deal.postalCode}` },
      { key: 'Property Type', value: deal.propertyType.replace('-', ' ').toUpperCase() },
      { key: 'Purchase Price', value: formatCurrency(deal.purchasePrice) },
      {
        key: 'After Repair Value',
        value: deal.afterRepairValue ? formatCurrency(deal.afterRepairValue) : 'N/A'
      },
      {
        key: 'Estimated Rent',
        value: deal.estimatedRent ? `${formatCurrency(deal.estimatedRent)}/mo` : 'N/A'
      }
    ]
  })

  // Investment Summary
  blocks.push({
    type: 'heading',
    level: 2,
    content: 'Investment Summary'
  })

  blocks.push({
    type: 'key-value',
    columns: 2,
    items: [
      { key: 'Total Investment', value: formatCurrency(metrics.totalInvestment) },
      {
        key: 'Down Payment',
        value: `${formatCurrency(metrics.downPayment)} (${deal.downPaymentPercent}%)`
      },
      { key: 'Loan Amount', value: formatCurrency(metrics.loanAmount) },
      { key: 'Monthly Mortgage', value: formatCurrency(metrics.monthlyMortgage) },
      { key: 'Repair Costs', value: formatCurrency(deal.repairCosts) },
      { key: 'Closing Costs', value: formatCurrency(deal.closingCosts) }
    ]
  })

  // Key Metrics
  blocks.push({
    type: 'heading',
    level: 2,
    content: 'Key Financial Metrics'
  })

  blocks.push({
    type: 'table',
    headers: ['Metric', 'Value', 'Assessment'],
    rows: [
      ['Cap Rate', formatPercent(metrics.capRate), assessCapRate(metrics.capRate)],
      [
        'Cash-on-Cash Return',
        formatPercent(metrics.cashOnCash),
        assessCashOnCash(metrics.cashOnCash)
      ],
      ['DSCR', formatRatio(metrics.dscr), assessDscr(metrics.dscr)],
      ['GRM', formatRatio(metrics.grm), assessGrm(metrics.grm)],
      ['Rental Yield', formatPercent(metrics.rentalYield), assessRentalYield(metrics.rentalYield)],
      [
        'Break-Even Ratio',
        formatPercent(metrics.breakEvenRatio),
        assessBreakEven(metrics.breakEvenRatio)
      ]
    ],
    columnWidths: [35, 25, 40]
  })

  // Cash Flow
  blocks.push({
    type: 'heading',
    level: 2,
    content: 'Cash Flow Analysis'
  })

  blocks.push({
    type: 'key-value',
    columns: 2,
    items: [
      { key: 'Monthly Rent', value: formatCurrency(metrics.monthlyRent) },
      { key: 'Annual Gross Rent', value: formatCurrency(metrics.annualRent) },
      { key: 'Vacancy Loss', value: formatCurrency(metrics.annualVacancyLoss) },
      { key: 'Effective Gross Income', value: formatCurrency(metrics.effectiveGrossIncome) },
      { key: 'Net Operating Income', value: formatCurrency(metrics.noi) },
      { key: 'Annual Cash Flow', value: formatCurrency(metrics.annualCashFlow) },
      { key: 'Monthly Cash Flow', value: formatCurrency(metrics.monthlyCashFlow) }
    ]
  })

  // Operating Expenses
  blocks.push({
    type: 'heading',
    level: 2,
    content: 'Operating Expenses (Annual)'
  })

  blocks.push({
    type: 'table',
    headers: ['Expense', 'Amount'],
    rows: [
      ['Property Tax', formatCurrency(metrics.annualPropertyTax)],
      ['Insurance', formatCurrency(metrics.annualInsurance)],
      ['HOA', formatCurrency(metrics.annualHoa)],
      ['Maintenance', formatCurrency(metrics.annualMaintenance)],
      ['Management', formatCurrency(metrics.annualManagement)],
      ['Total Expenses', formatCurrency(metrics.totalAnnualExpenses)]
    ],
    columnWidths: [60, 40]
  })

  // Flip Analysis (if ARV provided)
  if (metrics.equityGain !== null && metrics.roi !== null) {
    blocks.push({
      type: 'heading',
      level: 2,
      content: 'Flip Analysis'
    })

    blocks.push({
      type: 'key-value',
      columns: 2,
      items: [
        { key: 'After Repair Value', value: formatCurrency(deal.afterRepairValue!) },
        {
          key: 'Total Costs',
          value: formatCurrency(deal.purchasePrice + deal.repairCosts + deal.closingCosts)
        },
        { key: 'Equity Gain', value: formatCurrency(metrics.equityGain) },
        { key: 'ROI', value: formatPercent(metrics.roi) }
      ]
    })
  }

  // Comparable Sales
  if (includeComps && comps.length > 0) {
    blocks.push({
      type: 'heading',
      level: 2,
      content: `Comparable Sales (${comps.length})`
    })

    blocks.push({
      type: 'table',
      headers: ['Address', 'Sale Price', 'Sq Ft', 'Beds/Baths', 'Date'],
      rows: comps.map((comp) => [
        `${comp.address}, ${comp.city}`,
        formatCurrency(comp.salePrice),
        comp.squareFeet?.toLocaleString() ?? 'N/A',
        `${comp.bedrooms ?? '-'}/${comp.bathrooms ?? '-'}`,
        comp.saleDate ?? 'N/A'
      ]),
      columnWidths: [30, 20, 15, 15, 20]
    })
  }

  // Additional Expenses
  if (includeExpenses && expenses.length > 0) {
    blocks.push({
      type: 'heading',
      level: 2,
      content: `Additional Expenses (${expenses.length})`
    })

    blocks.push({
      type: 'table',
      headers: ['Category', 'Description', 'Amount'],
      rows: expenses.map((exp) => [
        exp.category.charAt(0).toUpperCase() + exp.category.slice(1),
        exp.description,
        formatCurrency(exp.amount)
      ]),
      columnWidths: [25, 50, 25]
    })
  }

  // Chart
  if (includeCharts && chartBase64) {
    blocks.push({
      type: 'heading',
      level: 2,
      content: 'Financial Overview'
    })

    blocks.push({
      type: 'image',
      base64: chartBase64,
      mimeType: 'image/png',
      align: 'center',
      caption: 'Monthly Cash Flow Breakdown'
    })
  }

  // Notes
  if (deal.notes) {
    blocks.push({
      type: 'heading',
      level: 2,
      content: 'Notes'
    })

    blocks.push({
      type: 'text',
      content: deal.notes
    })
  }

  // Build PDF
  const builder = new PdfBuilder({
    title: `Deal Analysis: ${deal.address}`,
    author: 'OpenOrbit Deal Analyzer',
    footer: 'Page {{page}}',
    mergeFields: {
      date: new Date().toLocaleDateString(),
      address: deal.address
    }
  })

  const result = await builder.build(blocks)

  // Determine output path
  let outputPath = options.outputPath
  if (!outputPath) {
    const sanitizedAddress = deal.address.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 50)
    outputPath = resolve(
      tmpdir(),
      `deal-analysis-${sanitizedAddress}-${randomUUID().slice(0, 8)}.pdf`
    )
  }

  // Ensure directory exists
  await mkdir(dirname(outputPath), { recursive: true })

  // Write file
  await writeFile(outputPath, result.buffer)

  return {
    filePath: outputPath,
    pageCount: result.pageCount,
    sizeBytes: result.buffer.length
  }
}

// Assessment helpers
function assessCapRate(rate: number): string {
  if (rate >= 0.1) return 'Excellent'
  if (rate >= 0.08) return 'Good'
  if (rate >= 0.06) return 'Average'
  if (rate >= 0.04) return 'Below Average'
  return 'Poor'
}

function assessCashOnCash(rate: number): string {
  if (rate >= 0.12) return 'Excellent'
  if (rate >= 0.08) return 'Good'
  if (rate >= 0.05) return 'Average'
  if (rate >= 0) return 'Below Average'
  return 'Negative'
}

function assessDscr(ratio: number): string {
  if (ratio >= 1.5) return 'Strong'
  if (ratio >= 1.25) return 'Good'
  if (ratio >= 1.0) return 'Borderline'
  return 'Insufficient'
}

function assessGrm(grm: number): string {
  if (grm <= 8) return 'Excellent'
  if (grm <= 12) return 'Good'
  if (grm <= 15) return 'Average'
  return 'High'
}

function assessRentalYield(yield_: number): string {
  if (yield_ >= 0.1) return 'Excellent'
  if (yield_ >= 0.08) return 'Good'
  if (yield_ >= 0.06) return 'Average'
  return 'Below Average'
}

function assessBreakEven(ratio: number): string {
  if (ratio <= 0.7) return 'Strong Buffer'
  if (ratio <= 0.85) return 'Good'
  if (ratio <= 0.95) return 'Tight'
  return 'Risky'
}
