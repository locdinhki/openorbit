// ============================================================================
// ext-zillow — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

export const extZillowSchemas = {
  'ext-zillow:search': z.object({
    address1: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1)
  }),

  'ext-zillow:get-arv': z.object({
    address1: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1)
  }),

  'ext-zillow:cache-list': z.object({
    limit: z.number().int().min(1).max(500).default(100)
  }),

  'ext-zillow:cache-delete': z.object({
    id: z.string().min(1)
  }),

  'ext-zillow:cache-purge': z.object({})
} as const
