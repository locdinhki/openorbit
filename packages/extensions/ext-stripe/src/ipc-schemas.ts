// ============================================================================
// ext-stripe — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

export const extStripeSchemas = {
  // Settings
  'ext-stripe:settings-get': z.object({}),
  'ext-stripe:settings-set': z.object({
    secretKey: z.string().optional(),
    webhookSecret: z.string().optional()
  }),
  'ext-stripe:connection-test': z.object({}),

  // Customers
  'ext-stripe:customers-list': z.object({
    query: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    startingAfter: z.string().optional()
  }),
  'ext-stripe:customers-get': z.object({ id: z.string().min(1) }),
  'ext-stripe:customers-create': z.object({
    email: z.string().email(),
    name: z.string().optional(),
    phone: z.string().optional(),
    metadata: z.record(z.string()).optional()
  }),
  'ext-stripe:customers-sync': z.object({}),

  // Payments
  'ext-stripe:payments-list': z.object({
    customerId: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    startingAfter: z.string().optional()
  }),
  'ext-stripe:payments-sync': z.object({}),
  'ext-stripe:payments-refund': z.object({
    paymentIntentId: z.string().min(1),
    amount: z.number().int().positive().optional() // Partial refund in cents
  }),

  // Payment Links
  'ext-stripe:payment-links-create': z.object({
    amount: z.number().int().positive(),
    currency: z.string().length(3).default('usd'),
    description: z.string().optional(),
    metadata: z.record(z.string()).optional()
  }),
  'ext-stripe:payment-links-list': z.object({
    active: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).optional()
  }),

  // Subscriptions
  'ext-stripe:subs-list': z.object({
    customerId: z.string().optional(),
    status: z.enum(['active', 'past_due', 'canceled', 'all']).optional(),
    limit: z.number().int().min(1).max(100).optional()
  }),
  'ext-stripe:subs-sync': z.object({}),
  'ext-stripe:subs-cancel': z.object({
    subscriptionId: z.string().min(1),
    cancelAtPeriodEnd: z.boolean().default(true)
  }),

  // Dashboard
  'ext-stripe:dashboard-metrics': z.object({
    startDate: z.string().optional(), // ISO date
    endDate: z.string().optional()
  })
} as const
