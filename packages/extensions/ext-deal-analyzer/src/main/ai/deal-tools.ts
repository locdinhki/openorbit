// ============================================================================
// ext-deal-analyzer — AI Tool Definitions
//
// Defines AI-exposed skills for deal analysis operations.
// These are registered with the SkillService and automatically exposed to AI.
// ============================================================================

import type { Skill, SkillResult } from '@openorbit/core/skills/skill-types'
import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { DealsRepo, type DealRow } from '../db/deals-repo'
import { DealCompsRepo } from '../db/deal-comps-repo'
import { DealExpensesRepo } from '../db/deal-expenses-repo'
import { analyzeDeal, formatCurrency, formatPercent, formatRatio } from '../analysis/deal-analyzer'
import { compareDeals } from '../analysis/deal-comparer'
import { exportDealPdf } from '../analysis/deal-exporter'
import { renderChart } from '@openorbit/core/skills/builtin/chart-renderer'

export function createDealAnalyzerSkills(ctx: ExtensionContext): Skill[] {
  const dealsRepo = new DealsRepo(ctx.db)
  const compsRepo = new DealCompsRepo(ctx.db)
  const expensesRepo = new DealExpensesRepo(ctx.db)

  const listDealsSkill: Skill = {
    id: 'deal-analyzer-list',
    displayName: 'List Deals',
    description: 'List all real estate deals in the system. Returns basic info about each deal.',
    category: 'data',
    extensionId: 'ext-deal-analyzer',
    icon: 'list',
    capabilities: { aiTool: true, offlineCapable: true },
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status: active, archived, or all',
          enum: ['active', 'archived', 'all']
        },
        limit: {
          type: 'number',
          description: 'Maximum number of deals to return (default 20)'
        }
      }
    },
    outputSchema: {
      type: 'object',
      properties: {
        deals: { type: 'array', description: 'List of deal summaries' }
      }
    },
    async execute(input): Promise<SkillResult> {
      const status = (input.status as 'active' | 'archived' | 'all') ?? 'active'
      const limit = (input.limit as number) ?? 20
      const deals = dealsRepo.list(limit, 0, status)

      if (deals.length === 0) {
        return { success: true, data: { deals: [] }, summary: 'No deals found.' }
      }

      const lines = deals.map(
        (d) =>
          `- ${d.address}, ${d.city}, ${d.state} — ${formatCurrency(d.purchasePrice)} (${d.status})`
      )

      return {
        success: true,
        data: {
          deals: deals.map((d) => ({
            id: d.id,
            address: d.address,
            city: d.city,
            state: d.state,
            purchasePrice: d.purchasePrice,
            status: d.status
          }))
        },
        summary: `Found ${deals.length} deal(s):\n${lines.join('\n')}`
      }
    }
  }

  const getDealAnalysisSkill: Skill = {
    id: 'deal-analyzer-analyze',
    displayName: 'Analyze Deal',
    description:
      'Get comprehensive financial analysis for a specific deal including all key metrics.',
    category: 'data',
    extensionId: 'ext-deal-analyzer',
    icon: 'calculator',
    capabilities: { aiTool: true, offlineCapable: true },
    inputSchema: {
      type: 'object',
      properties: {
        dealId: {
          type: 'string',
          description: 'The ID of the deal to analyze'
        }
      },
      required: ['dealId']
    },
    outputSchema: {
      type: 'object',
      properties: {
        deal: { type: 'object', description: 'Deal details' },
        metrics: { type: 'object', description: 'Financial metrics' }
      }
    },
    async execute(input): Promise<SkillResult> {
      const dealId = input.dealId as string
      const deal = dealsRepo.get(dealId)

      if (!deal) {
        return { success: false, error: `Deal not found: ${dealId}` }
      }

      const expenses = expensesRepo.getTotal(dealId)
      const metrics = analyzeDeal(deal, expenses)
      const comps = compsRepo.list(dealId)

      const analysisText = [
        `**Deal Analysis: ${deal.address}, ${deal.city}, ${deal.state}**`,
        '',
        '**Investment Summary**',
        `- Purchase Price: ${formatCurrency(deal.purchasePrice)}`,
        `- Total Investment: ${formatCurrency(metrics.totalInvestment)}`,
        `- Down Payment: ${formatCurrency(metrics.downPayment)} (${deal.downPaymentPercent}%)`,
        `- Loan Amount: ${formatCurrency(metrics.loanAmount)}`,
        '',
        '**Key Metrics**',
        `- Cap Rate: ${formatPercent(metrics.capRate)}`,
        `- Cash-on-Cash Return: ${formatPercent(metrics.cashOnCash)}`,
        `- DSCR: ${formatRatio(metrics.dscr)}`,
        `- GRM: ${formatRatio(metrics.grm)}`,
        '',
        '**Cash Flow**',
        `- Monthly Rent: ${formatCurrency(metrics.monthlyRent)}`,
        `- NOI: ${formatCurrency(metrics.noi)}/year`,
        `- Monthly Cash Flow: ${formatCurrency(metrics.monthlyCashFlow)}`,
        `- Annual Cash Flow: ${formatCurrency(metrics.annualCashFlow)}`
      ]

      if (metrics.roi !== null) {
        analysisText.push('')
        analysisText.push('**Flip Analysis**')
        analysisText.push(`- ARV: ${formatCurrency(deal.afterRepairValue!)}`)
        analysisText.push(`- Equity Gain: ${formatCurrency(metrics.equityGain!)}`)
        analysisText.push(`- ROI: ${formatPercent(metrics.roi)}`)
      }

      if (comps.length > 0) {
        analysisText.push('')
        analysisText.push(`**Comparable Sales (${comps.length})**`)
        const avgPrice = compsRepo.getAveragePrice(dealId)
        if (avgPrice) {
          analysisText.push(`- Average Comp Price: ${formatCurrency(avgPrice)}`)
        }
      }

      return {
        success: true,
        data: { deal, metrics, compsCount: comps.length },
        summary: analysisText.join('\n')
      }
    }
  }

  const createDealSkill: Skill = {
    id: 'deal-analyzer-create',
    displayName: 'Create Deal',
    description: 'Create a new real estate deal for analysis.',
    category: 'data',
    extensionId: 'ext-deal-analyzer',
    icon: 'plus',
    capabilities: { aiTool: true, offlineCapable: true },
    inputSchema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Property street address' },
        city: { type: 'string', description: 'City' },
        state: { type: 'string', description: 'State (2-letter code)' },
        postalCode: { type: 'string', description: 'ZIP code' },
        purchasePrice: { type: 'number', description: 'Purchase price in dollars' },
        estimatedRent: { type: 'number', description: 'Monthly rent estimate in dollars' },
        afterRepairValue: { type: 'number', description: 'ARV for flip analysis' },
        repairCosts: { type: 'number', description: 'Estimated repair costs' },
        downPaymentPercent: { type: 'number', description: 'Down payment percentage (default 20)' },
        interestRate: { type: 'number', description: 'Annual interest rate (default 7)' },
        notes: { type: 'string', description: 'Additional notes' }
      },
      required: ['address', 'city', 'state', 'postalCode', 'purchasePrice']
    },
    outputSchema: {
      type: 'object',
      properties: {
        deal: { type: 'object', description: 'Created deal' },
        metrics: { type: 'object', description: 'Initial financial metrics' }
      }
    },
    async execute(input): Promise<SkillResult> {
      const deal = dealsRepo.create({
        address: input.address as string,
        city: input.city as string,
        state: input.state as string,
        postalCode: input.postalCode as string,
        purchasePrice: input.purchasePrice as number,
        estimatedRent: input.estimatedRent as number | undefined,
        afterRepairValue: input.afterRepairValue as number | undefined,
        repairCosts: input.repairCosts as number | undefined,
        downPaymentPercent: input.downPaymentPercent as number | undefined,
        interestRate: input.interestRate as number | undefined,
        notes: input.notes as string | undefined
      })

      const metrics = analyzeDeal(deal)

      return {
        success: true,
        data: { deal, metrics },
        summary:
          `Created deal: ${deal.address}, ${deal.city}, ${deal.state}\n` +
          `Purchase Price: ${formatCurrency(deal.purchasePrice)}\n` +
          `Cap Rate: ${formatPercent(metrics.capRate)}\n` +
          `Cash-on-Cash: ${formatPercent(metrics.cashOnCash)}\n` +
          `Monthly Cash Flow: ${formatCurrency(metrics.monthlyCashFlow)}`
      }
    }
  }

  const compareDealsSkill: Skill = {
    id: 'deal-analyzer-compare',
    displayName: 'Compare Deals',
    description: 'Compare multiple deals side by side to identify the best investment opportunity.',
    category: 'data',
    extensionId: 'ext-deal-analyzer',
    icon: 'git-compare',
    capabilities: { aiTool: true, offlineCapable: true },
    inputSchema: {
      type: 'object',
      properties: {
        dealIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of 2-4 deal IDs to compare'
        }
      },
      required: ['dealIds']
    },
    outputSchema: {
      type: 'object',
      properties: {
        comparison: { type: 'object', description: 'Comparison results' }
      }
    },
    async execute(input): Promise<SkillResult> {
      const dealIds = input.dealIds as string[]

      if (!dealIds || dealIds.length < 2 || dealIds.length > 4) {
        return { success: false, error: 'Please provide 2-4 deal IDs to compare.' }
      }

      const deals: DealRow[] = []
      for (const id of dealIds) {
        const deal = dealsRepo.get(id)
        if (!deal) {
          return { success: false, error: `Deal not found: ${id}` }
        }
        deals.push(deal)
      }

      const additionalExpenses: Record<string, number> = {}
      for (const deal of deals) {
        additionalExpenses[deal.id] = expensesRepo.getTotal(deal.id)
      }

      const comparison = compareDeals(deals, additionalExpenses)

      return {
        success: true,
        data: comparison,
        summary: comparison.summary
      }
    }
  }

  const addExpenseSkill: Skill = {
    id: 'deal-analyzer-add-expense',
    displayName: 'Add Deal Expense',
    description: 'Add an expense line item to a deal.',
    category: 'data',
    extensionId: 'ext-deal-analyzer',
    icon: 'receipt',
    capabilities: { aiTool: true, offlineCapable: true },
    inputSchema: {
      type: 'object',
      properties: {
        dealId: { type: 'string', description: 'The deal ID to add expense to' },
        category: {
          type: 'string',
          description: 'Expense category',
          enum: ['repair', 'renovation', 'closing', 'holding', 'other']
        },
        description: { type: 'string', description: 'Description of the expense' },
        amount: { type: 'number', description: 'Expense amount in dollars' }
      },
      required: ['dealId', 'category', 'description', 'amount']
    },
    outputSchema: {
      type: 'object',
      properties: {
        expense: { type: 'object', description: 'Created expense' },
        totalExpenses: { type: 'number', description: 'Total expenses for the deal' }
      }
    },
    async execute(input): Promise<SkillResult> {
      const deal = dealsRepo.get(input.dealId as string)
      if (!deal) {
        return { success: false, error: `Deal not found: ${input.dealId}` }
      }

      const expense = expensesRepo.add({
        dealId: input.dealId as string,
        category: input.category as 'repair' | 'renovation' | 'closing' | 'holding' | 'other',
        description: input.description as string,
        amount: input.amount as number
      })

      const totalExpenses = expensesRepo.getTotal(input.dealId as string)

      return {
        success: true,
        data: { expense, totalExpenses },
        summary: `Added expense: ${expense.description} (${formatCurrency(expense.amount)}) to ${deal.address}\nTotal additional expenses: ${formatCurrency(totalExpenses)}`
      }
    }
  }

  const exportPdfSkill: Skill = {
    id: 'deal-analyzer-export-pdf',
    displayName: 'Export Deal PDF',
    description: 'Export a comprehensive PDF report for a deal including all analysis and charts.',
    category: 'document',
    extensionId: 'ext-deal-analyzer',
    icon: 'file-text',
    capabilities: { aiTool: true, offlineCapable: true },
    inputSchema: {
      type: 'object',
      properties: {
        dealId: { type: 'string', description: 'The deal ID to export' },
        includeComps: { type: 'boolean', description: 'Include comparable sales (default true)' },
        includeExpenses: { type: 'boolean', description: 'Include expenses (default true)' },
        includeCharts: { type: 'boolean', description: 'Include charts (default true)' }
      },
      required: ['dealId']
    },
    outputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to generated PDF' },
        pageCount: { type: 'number', description: 'Number of pages' },
        sizeBytes: { type: 'number', description: 'File size in bytes' }
      }
    },
    async execute(input): Promise<SkillResult> {
      const deal = dealsRepo.get(input.dealId as string)
      if (!deal) {
        return { success: false, error: `Deal not found: ${input.dealId}` }
      }

      const expenses = expensesRepo.list(input.dealId as string)
      const comps = compsRepo.list(input.dealId as string)
      const additionalExpenses = expensesRepo.getTotal(input.dealId as string)
      const metrics = analyzeDeal(deal, additionalExpenses)

      // Generate chart
      let chartBase64: string | null = null
      const includeCharts = input.includeCharts !== false

      if (includeCharts) {
        try {
          const chartResult = await renderChart({
            type: 'bar',
            title: 'Monthly Cash Flow Breakdown',
            labels: ['Rent', 'Mortgage', 'Taxes', 'Insurance', 'Other', 'Cash Flow'],
            datasets: [
              {
                label: 'Monthly ($)',
                data: [
                  metrics.monthlyRent,
                  -metrics.monthlyMortgage,
                  -metrics.annualPropertyTax / 12,
                  -metrics.annualInsurance / 12,
                  -(metrics.annualMaintenance + metrics.annualManagement + metrics.annualHoa) / 12,
                  metrics.monthlyCashFlow
                ]
              }
            ],
            width: 600,
            height: 400
          })
          chartBase64 = chartResult.base64
        } catch {
          // Chart generation failed, continue without chart
        }
      }

      const result = await exportDealPdf(deal, metrics, comps, expenses, chartBase64, {
        includeComps: input.includeComps !== false,
        includeExpenses: input.includeExpenses !== false,
        includeCharts
      })

      return {
        success: true,
        data: result,
        summary: `Exported PDF report for ${deal.address}\nSaved to: ${result.filePath}\nPages: ${result.pageCount}, Size: ${Math.round(result.sizeBytes / 1024)}KB`
      }
    }
  }

  return [
    listDealsSkill,
    getDealAnalysisSkill,
    createDealSkill,
    compareDealsSkill,
    addExpenseSkill,
    exportPdfSkill
  ]
}
