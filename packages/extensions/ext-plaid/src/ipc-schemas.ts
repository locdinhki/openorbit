// ============================================================================
// ext-plaid — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

export const extPlaidSchemas = {
  // Settings
  'ext-plaid:settings-get': z.object({}),
  'ext-plaid:settings-set': z.object({
    clientId: z.string().optional(),
    secret: z.string().optional(),
    environment: z.enum(['sandbox', 'development', 'production']).optional()
  }),

  // Link
  'ext-plaid:link-token-create': z.object({
    userId: z.string().optional() // Optional user identifier
  }),
  'ext-plaid:link-exchange': z.object({
    publicToken: z.string().min(1)
  }),

  // Items
  'ext-plaid:items-list': z.object({}),
  'ext-plaid:items-remove': z.object({
    itemId: z.string().min(1)
  }),

  // Accounts
  'ext-plaid:accounts-list': z.object({
    itemId: z.string().optional()
  }),
  'ext-plaid:accounts-sync': z.object({
    itemId: z.string().optional() // If not provided, sync all items
  }),

  // Transactions
  'ext-plaid:transactions-list': z.object({
    accountId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().int().min(1).max(500).optional(),
    offset: z.number().int().min(0).optional()
  }),
  'ext-plaid:transactions-sync': z.object({
    itemId: z.string().optional() // If not provided, sync all items
  })
} as const
