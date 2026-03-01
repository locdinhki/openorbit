// ============================================================================
// Tax Report Generator
// ============================================================================

import type { BkCategoriesRepo, BkCategoryRow } from '../db/categories-repo'
import type { BkTransactionsRepo } from '../db/transactions-repo'

export interface TaxCategoryTotal {
  taxCategory: string
  name: string
  amount: number
  transactionCount: number
}

export interface TaxReport {
  year: number
  income: TaxCategoryTotal[]
  expenses: TaxCategoryTotal[]
  summary: {
    totalIncome: number
    totalDeductions: number
    netTaxableIncome: number
  }
}

export class TaxReportGenerator {
  constructor(
    private categoriesRepo: BkCategoriesRepo,
    private transactionsRepo: BkTransactionsRepo
  ) {}

  generate(year: number): TaxReport {
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const allCategories = this.categoriesRepo.list()
    const incomeCategories = allCategories.filter((c) => c.type === 'income')
    const expenseCategories = allCategories.filter((c) => c.type === 'expense')

    const incomeData = this.aggregateByTaxCategory(incomeCategories, startDate, endDate)
    const expenseData = this.aggregateByTaxCategory(expenseCategories, startDate, endDate)

    const totalIncome = incomeData.reduce((sum, c) => sum + c.amount, 0)
    const totalDeductions = expenseData.reduce((sum, c) => sum + c.amount, 0)

    return {
      year,
      income: incomeData,
      expenses: expenseData,
      summary: {
        totalIncome,
        totalDeductions,
        netTaxableIncome: totalIncome - totalDeductions
      }
    }
  }

  private aggregateByTaxCategory(
    categories: BkCategoryRow[],
    startDate: string,
    endDate: string
  ): TaxCategoryTotal[] {
    const taxCategoryMap = new Map<string, { amount: number; count: number; name: string }>()

    for (const cat of categories) {
      const taxCategory = cat.tax_category || 'uncategorized'
      const transactions = this.transactionsRepo.list({
        categoryId: cat.id,
        startDate,
        endDate,
        limit: 10000
      })

      const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0)
      if (total === 0) continue

      const existing = taxCategoryMap.get(taxCategory) ?? { amount: 0, count: 0, name: '' }
      existing.amount += total
      existing.count += transactions.length
      existing.name = this.formatTaxCategoryName(taxCategory)
      taxCategoryMap.set(taxCategory, existing)
    }

    return Array.from(taxCategoryMap.entries())
      .map(([taxCategory, data]) => ({
        taxCategory,
        name: data.name,
        amount: data.amount,
        transactionCount: data.count
      }))
      .sort((a, b) => b.amount - a.amount)
  }

  private formatTaxCategoryName(taxCategory: string): string {
    // Convert snake_case to Title Case
    return taxCategory
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  generateScheduleC(year: number): Record<string, number> {
    const report = this.generate(year)
    const scheduleC: Record<string, number> = {}

    // Map tax categories to Schedule C lines
    const expenseMapping: Record<string, string> = {
      advertising: 'Line 8 - Advertising',
      bank_fees: 'Line 27a - Other Expenses (Bank Fees)',
      contract_labor: 'Line 11 - Contract Labor',
      equipment: 'Line 13 - Depreciation/Sec 179',
      insurance: 'Line 15 - Insurance',
      meals: 'Line 24b - Meals (50%)',
      office_supplies: 'Line 18 - Office Expense',
      professional_services: 'Line 17 - Legal & Professional',
      rent: 'Line 20b - Rent (Other)',
      software: 'Line 27a - Other Expenses (Software)',
      travel: 'Line 24a - Travel',
      utilities: 'Line 25 - Utilities',
      other_expenses: 'Line 27a - Other Expenses'
    }

    for (const exp of report.expenses) {
      const line = expenseMapping[exp.taxCategory] || 'Line 27a - Other Expenses'
      scheduleC[line] = (scheduleC[line] ?? 0) + exp.amount
    }

    // Add income
    scheduleC['Line 1 - Gross Receipts'] = report.summary.totalIncome
    scheduleC['Line 28 - Total Expenses'] = report.summary.totalDeductions
    scheduleC['Line 31 - Net Profit'] = report.summary.netTaxableIncome

    return scheduleC
  }
}
