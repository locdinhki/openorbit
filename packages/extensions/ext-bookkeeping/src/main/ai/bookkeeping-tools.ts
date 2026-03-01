// ============================================================================
// Bookkeeping AI Tools — For AI chat integration
// ============================================================================

import type { BkAccountsRepo } from '../db/accounts-repo'
import type { BkCategoriesRepo } from '../db/categories-repo'
import type { BkTransactionsRepo } from '../db/transactions-repo'

export interface BookkeepingToolContext {
  accountsRepo: BkAccountsRepo
  categoriesRepo: BkCategoriesRepo
  transactionsRepo: BkTransactionsRepo
}

export const bookkeepingTools = {
  getAccountBalance: {
    name: 'get_account_balance',
    description: 'Get the current balance of a bookkeeping account',
    parameters: {
      type: 'object',
      properties: {
        accountId: { type: 'string', description: 'Account ID' }
      },
      required: ['accountId']
    },
    execute: async (
      params: { accountId: string },
      ctx: BookkeepingToolContext
    ): Promise<{ balance: number; name: string } | null> => {
      const account = ctx.accountsRepo.getById(params.accountId)
      if (!account) return null
      return { balance: account.current_balance, name: account.name }
    }
  },

  listAccounts: {
    name: 'list_accounts',
    description: 'List all bookkeeping accounts',
    parameters: { type: 'object', properties: {} },
    execute: async (
      _params: Record<string, never>,
      ctx: BookkeepingToolContext
    ): Promise<Array<{ id: string; name: string; balance: number }>> => {
      const accounts = ctx.accountsRepo.list()
      return accounts.map((a) => ({
        id: a.id,
        name: a.name,
        balance: a.current_balance
      }))
    }
  },

  getUncategorizedCount: {
    name: 'get_uncategorized_count',
    description: 'Get the number of uncategorized transactions',
    parameters: { type: 'object', properties: {} },
    execute: async (
      _params: Record<string, never>,
      ctx: BookkeepingToolContext
    ): Promise<{ count: number }> => {
      const count = ctx.transactionsRepo.countUncategorized()
      return { count }
    }
  },

  getExpensesByCategory: {
    name: 'get_expenses_by_category',
    description: 'Get total expenses by category for a date range',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' }
      },
      required: ['startDate', 'endDate']
    },
    execute: async (
      params: { startDate: string; endDate: string },
      ctx: BookkeepingToolContext
    ): Promise<Array<{ category: string; total: number }>> => {
      const categories = ctx.categoriesRepo.listByType('expense')
      const result: Array<{ category: string; total: number }> = []

      for (const cat of categories) {
        const total = ctx.transactionsRepo.sumByCategory(cat.id, params.startDate, params.endDate)
        if (total !== 0) {
          result.push({ category: cat.name, total: Math.abs(total) })
        }
      }

      return result.sort((a, b) => b.total - a.total)
    }
  },

  createTransaction: {
    name: 'create_transaction',
    description: 'Create a new transaction',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
        amount: { type: 'number', description: 'Amount (negative for expenses)' },
        description: { type: 'string', description: 'Transaction description' },
        accountId: { type: 'string', description: 'Account ID' },
        categoryId: { type: 'string', description: 'Category ID (optional)' }
      },
      required: ['date', 'amount', 'description', 'accountId']
    },
    execute: async (
      params: {
        date: string
        amount: number
        description: string
        accountId: string
        categoryId?: string
      },
      ctx: BookkeepingToolContext
    ): Promise<{ id: string; success: boolean }> => {
      const txn = ctx.transactionsRepo.create({
        date: params.date,
        amount: params.amount,
        description: params.description,
        accountId: params.accountId,
        categoryId: params.categoryId
      })
      ctx.accountsRepo.recalculateBalance(params.accountId)
      return { id: txn.id, success: true }
    }
  }
}
