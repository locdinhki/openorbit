// ============================================================================
// ext-invoicing — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().min(0)
})

const customerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  address: z.string().optional(),
  phone: z.string().optional()
})

export const extInvoicingSchemas = {
  // Settings
  'ext-invoicing:settings-get': z.object({}),
  'ext-invoicing:settings-set': z.object({
    companyName: z.string().optional(),
    companyEmail: z.string().email().optional(),
    companyAddress: z.string().optional(),
    defaultTaxRate: z.number().min(0).max(100).optional(),
    paymentTermsDays: z.number().int().min(0).optional()
  }),

  // Invoices
  'ext-invoicing:invoices-list': z.object({
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'void', 'all']).optional(),
    customerId: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional()
  }),
  'ext-invoicing:invoices-get': z.object({ id: z.string().min(1) }),
  'ext-invoicing:invoices-create': z.object({
    customer: customerSchema,
    items: z.array(invoiceItemSchema).min(1),
    taxRate: z.number().min(0).max(100).optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
    templateId: z.string().optional()
  }),
  'ext-invoicing:invoices-update': z.object({
    id: z.string().min(1),
    customer: customerSchema.optional(),
    items: z.array(invoiceItemSchema).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional()
  }),
  'ext-invoicing:invoices-delete': z.object({ id: z.string().min(1) }),

  // Invoice Actions
  'ext-invoicing:invoices-send': z.object({
    id: z.string().min(1),
    includePaymentLink: z.boolean().default(true)
  }),
  'ext-invoicing:invoices-mark-paid': z.object({
    id: z.string().min(1),
    paymentMethod: z.enum(['cash', 'check', 'bank_transfer', 'stripe', 'other']).optional(),
    paymentDate: z.string().optional(),
    notes: z.string().optional()
  }),
  'ext-invoicing:invoices-void': z.object({
    id: z.string().min(1),
    reason: z.string().optional()
  }),
  'ext-invoicing:invoices-download-pdf': z.object({ id: z.string().min(1) }),
  'ext-invoicing:invoices-create-payment-link': z.object({ id: z.string().min(1) }),

  // Templates
  'ext-invoicing:templates-list': z.object({}),
  'ext-invoicing:templates-create': z.object({
    name: z.string().min(1),
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().optional(),
    headerText: z.string().optional(),
    footerText: z.string().optional()
  }),
  'ext-invoicing:templates-update': z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().optional(),
    headerText: z.string().optional(),
    footerText: z.string().optional()
  }),
  'ext-invoicing:templates-delete': z.object({ id: z.string().min(1) }),

  // Recurring
  'ext-invoicing:recurring-list': z.object({
    active: z.boolean().optional()
  }),
  'ext-invoicing:recurring-create': z.object({
    customer: customerSchema,
    items: z.array(invoiceItemSchema).min(1),
    frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
    startDate: z.string(),
    autoSend: z.boolean().default(true)
  }),
  'ext-invoicing:recurring-update': z.object({
    id: z.string().min(1),
    items: z.array(invoiceItemSchema).optional(),
    frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']).optional(),
    nextDate: z.string().optional(),
    autoSend: z.boolean().optional()
  }),
  'ext-invoicing:recurring-pause': z.object({
    id: z.string().min(1),
    paused: z.boolean()
  }),

  // Payments
  'ext-invoicing:payments-list': z.object({
    invoiceId: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional()
  }),
  'ext-invoicing:payments-record': z.object({
    invoiceId: z.string().min(1),
    amount: z.number().positive(),
    paymentMethod: z.enum(['cash', 'check', 'bank_transfer', 'stripe', 'other']),
    paymentDate: z.string().optional(),
    notes: z.string().optional()
  }),

  // Dashboard
  'ext-invoicing:dashboard-stats': z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional()
  })
} as const
