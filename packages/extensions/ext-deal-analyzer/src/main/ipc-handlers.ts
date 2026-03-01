// ============================================================================
// ext-deal-analyzer — IPC Handler Registration
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { EXT_DEAL_ANALYZER_IPC } from '../ipc-channels'
import { extDealAnalyzerSchemas } from '../ipc-schemas'
import { DealsRepo } from './db/deals-repo'
import { DealCompsRepo } from './db/deal-comps-repo'
import { DealExpensesRepo } from './db/deal-expenses-repo'
import { analyzeDeal } from './analysis/deal-analyzer'
import { compareDeals } from './analysis/deal-comparer'
import { exportDealPdf } from './analysis/deal-exporter'
import { renderChart } from '@openorbit/core/skills/builtin/chart-renderer'

export function registerDealAnalyzerHandlers(ctx: ExtensionContext): void {
  const { ipc, log, db } = ctx
  const dealsRepo = new DealsRepo(db)
  const compsRepo = new DealCompsRepo(db)
  const expensesRepo = new DealExpensesRepo(db)

  // ========================================================================
  // Deals CRUD
  // ========================================================================

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.DEALS_LIST,
    extDealAnalyzerSchemas['ext-deal-analyzer:deals-list'],
    (_event, { limit, offset, status }) => {
      try {
        const deals = dealsRepo.list(limit, offset, status)
        return { success: true, data: deals }
      } catch (err) {
        log.error('Failed to list deals', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.DEALS_GET,
    extDealAnalyzerSchemas['ext-deal-analyzer:deals-get'],
    (_event, { id }) => {
      try {
        const deal = dealsRepo.get(id)
        if (!deal) {
          return { success: false, error: 'Deal not found', code: 'NOT_FOUND' }
        }
        return { success: true, data: deal }
      } catch (err) {
        log.error('Failed to get deal', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.DEALS_CREATE,
    extDealAnalyzerSchemas['ext-deal-analyzer:deals-create'],
    (_event, input) => {
      try {
        const deal = dealsRepo.create(input)
        return { success: true, data: deal }
      } catch (err) {
        log.error('Failed to create deal', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.DEALS_UPDATE,
    extDealAnalyzerSchemas['ext-deal-analyzer:deals-update'],
    (_event, input) => {
      try {
        const deal = dealsRepo.update(input)
        if (!deal) {
          return { success: false, error: 'Deal not found', code: 'NOT_FOUND' }
        }
        return { success: true, data: deal }
      } catch (err) {
        log.error('Failed to update deal', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.DEALS_DELETE,
    extDealAnalyzerSchemas['ext-deal-analyzer:deals-delete'],
    (_event, { id }) => {
      try {
        const deleted = dealsRepo.delete(id)
        if (!deleted) {
          return { success: false, error: 'Deal not found', code: 'NOT_FOUND' }
        }
        return { success: true, data: { deleted: true } }
      } catch (err) {
        log.error('Failed to delete deal', err)
        return errorToResponse(err)
      }
    }
  )

  // ========================================================================
  // Comps
  // ========================================================================

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.COMPS_LIST,
    extDealAnalyzerSchemas['ext-deal-analyzer:comps-list'],
    (_event, { dealId }) => {
      try {
        const comps = compsRepo.list(dealId)
        return { success: true, data: comps }
      } catch (err) {
        log.error('Failed to list comps', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.COMPS_ADD,
    extDealAnalyzerSchemas['ext-deal-analyzer:comps-add'],
    (_event, input) => {
      try {
        const comp = compsRepo.add(input)
        return { success: true, data: comp }
      } catch (err) {
        log.error('Failed to add comp', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.COMPS_DELETE,
    extDealAnalyzerSchemas['ext-deal-analyzer:comps-delete'],
    (_event, { id }) => {
      try {
        const deleted = compsRepo.delete(id)
        if (!deleted) {
          return { success: false, error: 'Comp not found', code: 'NOT_FOUND' }
        }
        return { success: true, data: { deleted: true } }
      } catch (err) {
        log.error('Failed to delete comp', err)
        return errorToResponse(err)
      }
    }
  )

  // ========================================================================
  // Expenses
  // ========================================================================

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.EXPENSES_LIST,
    extDealAnalyzerSchemas['ext-deal-analyzer:expenses-list'],
    (_event, { dealId }) => {
      try {
        const expenses = expensesRepo.list(dealId)
        return { success: true, data: expenses }
      } catch (err) {
        log.error('Failed to list expenses', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.EXPENSES_ADD,
    extDealAnalyzerSchemas['ext-deal-analyzer:expenses-add'],
    (_event, input) => {
      try {
        const expense = expensesRepo.add(input)
        return { success: true, data: expense }
      } catch (err) {
        log.error('Failed to add expense', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.EXPENSES_DELETE,
    extDealAnalyzerSchemas['ext-deal-analyzer:expenses-delete'],
    (_event, { id }) => {
      try {
        const deleted = expensesRepo.delete(id)
        if (!deleted) {
          return { success: false, error: 'Expense not found', code: 'NOT_FOUND' }
        }
        return { success: true, data: { deleted: true } }
      } catch (err) {
        log.error('Failed to delete expense', err)
        return errorToResponse(err)
      }
    }
  )

  // ========================================================================
  // Analysis
  // ========================================================================

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.ANALYZE,
    extDealAnalyzerSchemas['ext-deal-analyzer:analyze'],
    (_event, { dealId }) => {
      try {
        const deal = dealsRepo.get(dealId)
        if (!deal) {
          return { success: false, error: 'Deal not found', code: 'NOT_FOUND' }
        }

        const additionalExpenses = expensesRepo.getTotal(dealId)
        const metrics = analyzeDeal(deal, additionalExpenses)
        const comps = compsRepo.list(dealId)
        const expenses = expensesRepo.list(dealId)

        return {
          success: true,
          data: {
            deal,
            metrics,
            comps,
            expenses,
            compsAveragePrice: compsRepo.getAveragePrice(dealId)
          }
        }
      } catch (err) {
        log.error('Failed to analyze deal', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.COMPARE,
    extDealAnalyzerSchemas['ext-deal-analyzer:compare'],
    (_event, { dealIds }) => {
      try {
        const deals = dealIds.map((id) => dealsRepo.get(id)).filter(Boolean) as NonNullable<
          ReturnType<typeof dealsRepo.get>
        >[]

        if (deals.length !== dealIds.length) {
          return { success: false, error: 'One or more deals not found', code: 'NOT_FOUND' }
        }

        const additionalExpenses: Record<string, number> = {}
        for (const deal of deals) {
          additionalExpenses[deal.id] = expensesRepo.getTotal(deal.id)
        }

        const comparison = compareDeals(deals, additionalExpenses)
        return { success: true, data: comparison }
      } catch (err) {
        log.error('Failed to compare deals', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DEAL_ANALYZER_IPC.EXPORT_PDF,
    extDealAnalyzerSchemas['ext-deal-analyzer:export-pdf'],
    async (_event, { dealId, includeComps, includeExpenses, includeCharts, outputPath }) => {
      try {
        const deal = dealsRepo.get(dealId)
        if (!deal) {
          return { success: false, error: 'Deal not found', code: 'NOT_FOUND' }
        }

        const expenses = expensesRepo.list(dealId)
        const comps = compsRepo.list(dealId)
        const additionalExpenses = expensesRepo.getTotal(dealId)
        const metrics = analyzeDeal(deal, additionalExpenses)

        // Generate chart
        let chartBase64: string | null = null
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
                    -(metrics.annualMaintenance + metrics.annualManagement + metrics.annualHoa) /
                      12,
                    metrics.monthlyCashFlow
                  ]
                }
              ],
              width: 600,
              height: 400
            })
            chartBase64 = chartResult.base64
          } catch (chartErr) {
            log.warn('Chart generation failed', chartErr)
          }
        }

        const result = await exportDealPdf(deal, metrics, comps, expenses, chartBase64, {
          includeComps,
          includeExpenses,
          includeCharts,
          outputPath
        })

        return { success: true, data: result }
      } catch (err) {
        log.error('Failed to export PDF', err)
        return errorToResponse(err)
      }
    }
  )

  log.info('ext-deal-analyzer IPC handlers registered (14 channels)')
}
