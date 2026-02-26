// ============================================================================
// ext-jobs — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

export const JobStatusSchema = z.enum([
  'new',
  'reviewed',
  'approved',
  'rejected',
  'applied',
  'skipped',
  'error'
])

export const PlatformSchema = z.enum([
  'linkedin',
  'indeed',
  'upwork',
  'dice',
  'wellfound',
  'glassdoor'
])

export const SearchConfigSchema = z.object({
  keywords: z.array(z.string()),
  location: z.array(z.string()),
  datePosted: z.enum(['past24hrs', 'pastWeek', 'pastMonth']),
  experienceLevel: z.array(z.string()),
  jobType: z.array(z.enum(['full-time', 'contract', 'freelance', 'part-time'])),
  salaryMin: z.number().optional(),
  easyApplyOnly: z.boolean().optional(),
  excludeTerms: z.array(z.string()),
  remoteOnly: z.boolean().optional()
})

export const ApplicationConfigSchema = z.object({
  resumeFile: z.string(),
  coverLetterTemplate: z.string().optional(),
  defaultAnswers: z.record(z.string(), z.string())
})

export const extJobsSchemas = {
  // Jobs
  'ext-jobs:list': z.object({
    filters: z
      .object({
        status: z.union([JobStatusSchema, z.array(JobStatusSchema)]).optional(),
        platform: z.string().optional(),
        profileId: z.string().optional(),
        minScore: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional()
      })
      .optional()
  }),
  'ext-jobs:update': z.object({
    id: z.string(),
    updates: z.object({
      status: JobStatusSchema.optional(),
      userNotes: z.string().optional()
    })
  }),
  'ext-jobs:approve': z.object({ id: z.string() }),
  'ext-jobs:reject': z.object({ id: z.string() }),
  'ext-jobs:delete': z.object({ id: z.string() }),
  'ext-jobs:refetch': z.object({}),

  // Profiles
  'ext-jobs:profiles-list': z.object({}),
  'ext-jobs:profiles-create': z.object({
    profile: z.object({
      name: z.string().min(1),
      enabled: z.boolean(),
      platform: PlatformSchema,
      search: SearchConfigSchema,
      application: ApplicationConfigSchema
    })
  }),
  'ext-jobs:profiles-update': z.object({
    id: z.string(),
    updates: z
      .object({
        name: z.string().min(1),
        enabled: z.boolean(),
        platform: PlatformSchema,
        search: SearchConfigSchema,
        application: ApplicationConfigSchema
      })
      .partial()
  }),
  'ext-jobs:profiles-delete': z.object({ id: z.string() }),

  // Automation
  'ext-jobs:automation-start': z.object({ profileId: z.string().optional() }),
  'ext-jobs:automation-stop': z.object({}),
  'ext-jobs:automation-pause': z.object({}),
  'ext-jobs:automation-status': z.object({}),

  // Chat
  'ext-jobs:chat-send': z.object({
    message: z.string(),
    selectedJobId: z.string().optional()
  }),
  'ext-jobs:chat-analyze': z.object({ jobId: z.string() }),

  // Application
  'ext-jobs:application-start': z.object({ jobId: z.string() }),
  'ext-jobs:application-answer': z.object({ answer: z.string() }),

  // Action Log
  'ext-jobs:action-log-list': z.object({ limit: z.number().optional() }),

  // Memory
  'ext-jobs:memory-search': z.object({
    query: z.string(),
    category: z.enum(['preference', 'company', 'pattern', 'answer']).optional(),
    limit: z.number().optional()
  }),
  'ext-jobs:memory-add': z.object({
    category: z.enum(['preference', 'company', 'pattern', 'answer']),
    content: z.string().min(1),
    source: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }),
  'ext-jobs:memory-delete': z.object({ id: z.string() }),
  'ext-jobs:memory-list': z.object({
    category: z.enum(['preference', 'company', 'pattern', 'answer']).optional(),
    limit: z.number().optional()
  })
} as const
