// ============================================================================
// ext-bookkeeping — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

export const extBookkeepingSchemas = {
  // Settings
  'ext-bookkeeping:settings-get': z.object({}),
  'ext-bookkeeping:settings-set': z.object({
    fiscalYearStart: z.number().int().min(1).max(12).optional(),
    defaultCurrency: z.string().length(3).optional()
  }),

  // Accounts
  'ext-bookkeeping:accounts-list': z.object({}),
  'ext-bookkeeping:accounts-create': z.object({
    name: z.string().min(1),
    type: z.enum(['checking', 'savings', 'credit_card', 'cash', 'investment', 'other']),
    openingBalance: z.number().optional()
  }),
  'ext-bookkeeping:accounts-update': z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    openingBalance: z.number().optional()
  }),
  'ext-bookkeeping:accounts-link-plaid': z.object({
    id: z.string().min(1),
    plaidAccountId: z.string().min(1)
  }),

  // Categories
  'ext-bookkeeping:categories-list': z.object({
    type: z.enum(['income', 'expense', 'all']).optional()
  }),
  'ext-bookkeeping:categories-create': z.object({
    name: z.string().min(1),
    type: z.enum(['income', 'expense']),
    parentId: z.string().optional(),
    taxCategory: z.string().optional()
  }),
  'ext-bookkeeping:categories-update': z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    parentId: z.string().nullable().optional(),
    taxCategory: z.string().optional()
  }),
  'ext-bookkeeping:categories-delete': z.object({ id: z.string().min(1) }),

  // Transactions
  'ext-bookkeeping:transactions-list': z.object({
    accountId: z.string().optional(),
    categoryId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    uncategorized: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
    offset: z.number().int().min(0).optional()
  }),
  'ext-bookkeeping:transactions-get': z.object({ id: z.string().min(1) }),
  'ext-bookkeeping:transactions-create': z.object({
    date: z.string(),
    amount: z.number(),
    description: z.string().min(1),
    payee: z.string().optional(),
    accountId: z.string().min(1),
    categoryId: z.string().optional(),
    notes: z.string().optional()
  }),
  'ext-bookkeeping:transactions-update': z.object({
    id: z.string().min(1),
    date: z.string().optional(),
    amount: z.number().optional(),
    description: z.string().optional(),
    payee: z.string().optional(),
    categoryId: z.string().nullable().optional(),
    notes: z.string().optional()
  }),
  'ext-bookkeeping:transactions-delete': z.object({ id: z.string().min(1) }),
  'ext-bookkeeping:transactions-bulk-categorize': z.object({
    ids: z.array(z.string().min(1)),
    categoryId: z.string().min(1)
  }),

  // AI
  'ext-bookkeeping:ai-categorize': z.object({
    transactionId: z.string().min(1)
  }),
  'ext-bookkeeping:ai-categorize-batch': z.object({
    transactionIds: z.array(z.string().min(1)).optional(),
    uncategorizedOnly: z.boolean().default(true)
  }),

  // Import
  'ext-bookkeeping:import-from-plaid': z.object({
    accountId: z.string().optional()
  }),
  'ext-bookkeeping:import-from-stripe': z.object({}),
  'ext-bookkeeping:import-from-csv': z.object({
    accountId: z.string().min(1),
    filePath: z.string().min(1),
    dateColumn: z.string().default('Date'),
    amountColumn: z.string().default('Amount'),
    descriptionColumn: z.string().default('Description')
  }),

  // Reports
  'ext-bookkeeping:report-profit-loss': z.object({
    startDate: z.string(),
    endDate: z.string()
  }),
  'ext-bookkeeping:report-cash-flow': z.object({
    startDate: z.string(),
    endDate: z.string()
  }),
  'ext-bookkeeping:report-tax': z.object({
    year: z.number().int().min(2000).max(2100)
  }),

  // Export
  'ext-bookkeeping:export-csv': z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    accountId: z.string().optional()
  }),
  'ext-bookkeeping:export-quickbooks': z.object({
    startDate: z.string(),
    endDate: z.string()
  })
} as const
