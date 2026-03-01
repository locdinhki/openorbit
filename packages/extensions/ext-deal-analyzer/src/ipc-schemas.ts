// ============================================================================
// ext-deal-analyzer — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

export const extDealAnalyzerSchemas = {
  // Deals CRUD
  'ext-deal-analyzer:deals-list': z.object({
    limit: z.number().int().min(1).max(500).default(100),
    offset: z.number().int().min(0).default(0),
    status: z.enum(['active', 'archived', 'all']).default('active')
  }),

  'ext-deal-analyzer:deals-get': z.object({
    id: z.string().min(1)
  }),

  'ext-deal-analyzer:deals-create': z.object({
    address: z.string().min(1),
    city: z.string().min(1),
    state: z.string().length(2),
    postalCode: z.string().min(5),
    propertyType: z
      .enum(['single-family', 'multi-family', 'condo', 'townhouse', 'commercial', 'land'])
      .default('single-family'),
    purchasePrice: z.number().positive(),
    afterRepairValue: z.number().positive().optional(),
    estimatedRent: z.number().positive().optional(),
    repairCosts: z.number().min(0).default(0),
    downPaymentPercent: z.number().min(0).max(100).default(20),
    interestRate: z.number().min(0).max(30).default(7),
    loanTermYears: z.number().int().min(1).max(40).default(30),
    closingCosts: z.number().min(0).default(0),
    propertyTaxRate: z.number().min(0).max(10).default(1.25),
    insuranceAnnual: z.number().min(0).default(0),
    hoaMonthly: z.number().min(0).default(0),
    vacancyRate: z.number().min(0).max(100).default(5),
    managementRate: z.number().min(0).max(100).default(10),
    maintenanceRate: z.number().min(0).max(100).default(5),
    notes: z.string().optional(),
    ghlContactId: z.string().optional(),
    ghlOpportunityId: z.string().optional()
  }),

  'ext-deal-analyzer:deals-update': z.object({
    id: z.string().min(1),
    address: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    state: z.string().length(2).optional(),
    postalCode: z.string().min(5).optional(),
    propertyType: z
      .enum(['single-family', 'multi-family', 'condo', 'townhouse', 'commercial', 'land'])
      .optional(),
    purchasePrice: z.number().positive().optional(),
    afterRepairValue: z.number().positive().optional(),
    estimatedRent: z.number().positive().optional(),
    repairCosts: z.number().min(0).optional(),
    downPaymentPercent: z.number().min(0).max(100).optional(),
    interestRate: z.number().min(0).max(30).optional(),
    loanTermYears: z.number().int().min(1).max(40).optional(),
    closingCosts: z.number().min(0).optional(),
    propertyTaxRate: z.number().min(0).max(10).optional(),
    insuranceAnnual: z.number().min(0).optional(),
    hoaMonthly: z.number().min(0).optional(),
    vacancyRate: z.number().min(0).max(100).optional(),
    managementRate: z.number().min(0).max(100).optional(),
    maintenanceRate: z.number().min(0).max(100).optional(),
    notes: z.string().optional(),
    ghlContactId: z.string().optional(),
    ghlOpportunityId: z.string().optional(),
    status: z.enum(['active', 'archived']).optional()
  }),

  'ext-deal-analyzer:deals-delete': z.object({
    id: z.string().min(1)
  }),

  // Comps
  'ext-deal-analyzer:comps-list': z.object({
    dealId: z.string().min(1)
  }),

  'ext-deal-analyzer:comps-add': z.object({
    dealId: z.string().min(1),
    address: z.string().min(1),
    city: z.string().min(1),
    state: z.string().length(2),
    postalCode: z.string().min(5),
    salePrice: z.number().positive(),
    saleDate: z.string().optional(),
    squareFeet: z.number().int().positive().optional(),
    bedrooms: z.number().int().min(0).optional(),
    bathrooms: z.number().min(0).optional(),
    yearBuilt: z.number().int().min(1800).max(2100).optional(),
    zillowUrl: z.string().url().optional(),
    notes: z.string().optional()
  }),

  'ext-deal-analyzer:comps-delete': z.object({
    id: z.string().min(1)
  }),

  // Expenses
  'ext-deal-analyzer:expenses-list': z.object({
    dealId: z.string().min(1)
  }),

  'ext-deal-analyzer:expenses-add': z.object({
    dealId: z.string().min(1),
    category: z.enum(['repair', 'renovation', 'closing', 'holding', 'other']),
    description: z.string().min(1),
    amount: z.number().min(0),
    isRecurring: z.boolean().default(false)
  }),

  'ext-deal-analyzer:expenses-delete': z.object({
    id: z.string().min(1)
  }),

  // Analysis
  'ext-deal-analyzer:analyze': z.object({
    dealId: z.string().min(1)
  }),

  'ext-deal-analyzer:compare': z.object({
    dealIds: z.array(z.string().min(1)).min(2).max(4)
  }),

  'ext-deal-analyzer:export-pdf': z.object({
    dealId: z.string().min(1),
    includeComps: z.boolean().default(true),
    includeExpenses: z.boolean().default(true),
    includeCharts: z.boolean().default(true),
    outputPath: z.string().optional()
  })
} as const
