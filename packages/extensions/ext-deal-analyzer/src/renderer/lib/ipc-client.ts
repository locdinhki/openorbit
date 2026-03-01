// ============================================================================
// ext-deal-analyzer — Renderer IPC Client
// ============================================================================

import { EXT_DEAL_ANALYZER_IPC } from '../../ipc-channels'
import type { DealRow, CreateDealInput, UpdateDealInput } from '../../main/db/deals-repo'
import type { DealCompRow, AddCompInput } from '../../main/db/deal-comps-repo'
import type { DealExpenseRow, AddExpenseInput } from '../../main/db/deal-expenses-repo'
import type { DealMetrics } from '../../main/analysis/deal-analyzer'
import type { DealComparison } from '../../main/analysis/deal-comparer'
import type { ExportResult } from '../../main/analysis/deal-exporter'

interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

const api = window.api

export interface DealAnalysis {
  deal: DealRow
  metrics: DealMetrics
  comps: DealCompRow[]
  expenses: DealExpenseRow[]
  compsAveragePrice: number | null
}

export const ipc = {
  deals: {
    list: (
      limit = 100,
      offset = 0,
      status: 'active' | 'archived' | 'all' = 'active'
    ): Promise<IPCResult<DealRow[]>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.DEALS_LIST, { limit, offset, status }) as Promise<
        IPCResult<DealRow[]>
      >,

    get: (id: string): Promise<IPCResult<DealRow>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.DEALS_GET, { id }) as Promise<IPCResult<DealRow>>,

    create: (input: CreateDealInput): Promise<IPCResult<DealRow>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.DEALS_CREATE, input) as Promise<IPCResult<DealRow>>,

    update: (input: UpdateDealInput): Promise<IPCResult<DealRow>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.DEALS_UPDATE, input) as Promise<IPCResult<DealRow>>,

    delete: (id: string): Promise<IPCResult<{ deleted: boolean }>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.DEALS_DELETE, { id }) as Promise<
        IPCResult<{ deleted: boolean }>
      >
  },

  comps: {
    list: (dealId: string): Promise<IPCResult<DealCompRow[]>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.COMPS_LIST, { dealId }) as Promise<IPCResult<DealCompRow[]>>,

    add: (input: AddCompInput): Promise<IPCResult<DealCompRow>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.COMPS_ADD, input) as Promise<IPCResult<DealCompRow>>,

    delete: (id: string): Promise<IPCResult<{ deleted: boolean }>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.COMPS_DELETE, { id }) as Promise<
        IPCResult<{ deleted: boolean }>
      >
  },

  expenses: {
    list: (dealId: string): Promise<IPCResult<DealExpenseRow[]>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.EXPENSES_LIST, { dealId }) as Promise<
        IPCResult<DealExpenseRow[]>
      >,

    add: (input: AddExpenseInput): Promise<IPCResult<DealExpenseRow>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.EXPENSES_ADD, input) as Promise<IPCResult<DealExpenseRow>>,

    delete: (id: string): Promise<IPCResult<{ deleted: boolean }>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.EXPENSES_DELETE, { id }) as Promise<
        IPCResult<{ deleted: boolean }>
      >
  },

  analysis: {
    analyze: (dealId: string): Promise<IPCResult<DealAnalysis>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.ANALYZE, { dealId }) as Promise<IPCResult<DealAnalysis>>,

    compare: (dealIds: string[]): Promise<IPCResult<DealComparison>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.COMPARE, { dealIds }) as Promise<IPCResult<DealComparison>>,

    exportPdf: (
      dealId: string,
      options: {
        includeComps?: boolean
        includeExpenses?: boolean
        includeCharts?: boolean
        outputPath?: string
      } = {}
    ): Promise<IPCResult<ExportResult>> =>
      api.invoke(EXT_DEAL_ANALYZER_IPC.EXPORT_PDF, {
        dealId,
        includeComps: options.includeComps ?? true,
        includeExpenses: options.includeExpenses ?? true,
        includeCharts: options.includeCharts ?? true,
        outputPath: options.outputPath
      }) as Promise<IPCResult<ExportResult>>
  }
}

export type {
  IPCResult,
  DealRow,
  DealCompRow,
  DealExpenseRow,
  DealMetrics,
  DealComparison,
  ExportResult
}
