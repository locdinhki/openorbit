// ============================================================================
// Profit & Loss Report Generator
// ============================================================================

import type { BkCategoriesRepo, BkCategoryRow } from '../db/categories-repo'
import type { BkTransactionsRepo } from '../db/transactions-repo'

export interface ProfitLossCategory {
  id: string
  name: string
  amount: number
  children?: ProfitLossCategory[]
}

export interface ProfitLossReport {
  startDate: string
  endDate: string
  income: {
    categories: ProfitLossCategory[]
    total: number
  }
  expenses: {
    categories: ProfitLossCategory[]
    total: number
  }
  netIncome: number
}

export class ProfitLossGenerator {
  constructor(
    private categoriesRepo: BkCategoriesRepo,
    private transactionsRepo: BkTransactionsRepo
  ) {}

  generate(startDate: string, endDate: string): ProfitLossReport {
    const incomeCategories = this.categoriesRepo.listByType('income')
    const expenseCategories = this.categoriesRepo.listByType('expense')

    const incomeData = this.buildCategoryTree(incomeCategories, startDate, endDate)
    const expenseData = this.buildCategoryTree(expenseCategories, startDate, endDate)

    const totalIncome = incomeData.reduce((sum, c) => sum + c.amount, 0)
    const totalExpenses = expenseData.reduce((sum, c) => sum + Math.abs(c.amount), 0)

    return {
      startDate,
      endDate,
      income: {
        categories: incomeData,
        total: totalIncome
      },
      expenses: {
        categories: expenseData,
        total: totalExpenses
      },
      netIncome: totalIncome - totalExpenses
    }
  }

  private buildCategoryTree(
    categories: BkCategoryRow[],
    startDate: string,
    endDate: string
  ): ProfitLossCategory[] {
    // Get root categories (no parent)
    const rootCategories = categories.filter((c) => !c.parent_id)
    const childMap = new Map<string, BkCategoryRow[]>()

    // Group children by parent
    for (const cat of categories) {
      if (cat.parent_id) {
        const children = childMap.get(cat.parent_id) ?? []
        children.push(cat)
        childMap.set(cat.parent_id, children)
      }
    }

    // Build tree with amounts
    const buildNode = (category: BkCategoryRow): ProfitLossCategory => {
      const children = childMap.get(category.id)
      const childNodes = children?.map(buildNode) ?? []
      const ownAmount = this.transactionsRepo.sumByCategory(category.id, startDate, endDate)
      const childAmount = childNodes.reduce((sum, c) => sum + c.amount, 0)

      return {
        id: category.id,
        name: category.name,
        amount: Math.abs(ownAmount) + childAmount,
        children: childNodes.length > 0 ? childNodes : undefined
      }
    }

    return rootCategories
      .map(buildNode)
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }
}
