// ============================================================================
// Cash Flow Report Generator
// ============================================================================

import type { BkAccountsRepo } from '../db/accounts-repo'
import type { BkTransactionsRepo } from '../db/transactions-repo'

export interface CashFlowPeriod {
  month: string
  inflows: number
  outflows: number
  net: number
  runningBalance: number
}

export interface CashFlowReport {
  startDate: string
  endDate: string
  periods: CashFlowPeriod[]
  summary: {
    totalInflows: number
    totalOutflows: number
    netChange: number
    startingBalance: number
    endingBalance: number
  }
}

export class CashFlowGenerator {
  constructor(
    private accountsRepo: BkAccountsRepo,
    private transactionsRepo: BkTransactionsRepo
  ) {}

  generate(startDate: string, endDate: string): CashFlowReport {
    const transactions = this.transactionsRepo.list({
      startDate,
      endDate,
      limit: 10000
    })

    // Calculate starting balance (sum of all accounts' opening balance + transactions before start date)
    const accounts = this.accountsRepo.list()
    const openingBalance = accounts.reduce((sum, a) => sum + a.opening_balance, 0)

    const priorTransactions = this.transactionsRepo.list({
      endDate: startDate,
      limit: 10000
    })
    const priorAmount = priorTransactions.reduce((sum, t) => sum + t.amount, 0)
    const startingBalance = openingBalance + priorAmount

    // Group transactions by month
    const monthlyData = new Map<string, { inflows: number; outflows: number }>()

    for (const txn of transactions) {
      const month = txn.date.substring(0, 7) // YYYY-MM
      const current = monthlyData.get(month) ?? { inflows: 0, outflows: 0 }

      if (txn.amount > 0) {
        current.inflows += txn.amount
      } else {
        current.outflows += Math.abs(txn.amount)
      }

      monthlyData.set(month, current)
    }

    // Build periods
    const periods: CashFlowPeriod[] = []
    let runningBalance = startingBalance

    // Get all months in range
    const startMonth = startDate.substring(0, 7)
    const endMonth = endDate.substring(0, 7)
    const months = this.getMonthRange(startMonth, endMonth)

    for (const month of months) {
      const data = monthlyData.get(month) ?? { inflows: 0, outflows: 0 }
      const net = data.inflows - data.outflows
      runningBalance += net

      periods.push({
        month,
        inflows: data.inflows,
        outflows: data.outflows,
        net,
        runningBalance
      })
    }

    const totalInflows = periods.reduce((sum, p) => sum + p.inflows, 0)
    const totalOutflows = periods.reduce((sum, p) => sum + p.outflows, 0)

    return {
      startDate,
      endDate,
      periods,
      summary: {
        totalInflows,
        totalOutflows,
        netChange: totalInflows - totalOutflows,
        startingBalance,
        endingBalance: runningBalance
      }
    }
  }

  private getMonthRange(start: string, end: string): string[] {
    const months: string[] = []
    const [startYear, startMonth] = start.split('-').map(Number)
    const [endYear, endMonth] = end.split('-').map(Number)

    let year = startYear
    let month = startMonth

    while (year < endYear || (year === endYear && month <= endMonth)) {
      months.push(`${year}-${String(month).padStart(2, '0')}`)
      month++
      if (month > 12) {
        month = 1
        year++
      }
    }

    return months
  }
}
