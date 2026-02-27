// ============================================================================
// OpenOrbit Shell — IPC Schemas (shell-only)
// Extension schemas live in their own packages (e.g. ext-jobs/ipc-schemas.ts)
// ============================================================================

import { z } from 'zod'

// --- Per-channel request argument schemas ---

export const ipcSchemas = {
  // Session
  'session:init': z.object({}),
  'session:status': z.object({}),
  'session:login': z.object({ platform: z.string() }),
  'session:save': z.object({}),
  'session:close': z.object({}),

  // Browser
  'browser:navigate': z.object({ url: z.string() }),
  'browser:screenshot': z.object({}),

  // Screencast (live browser view)
  'screencast:start': z.object({
    platform: z.string().optional(),
    quality: z.number().min(0).max(100).optional(),
    maxWidth: z.number().optional(),
    maxHeight: z.number().optional(),
    everyNthFrame: z.number().optional()
  }),
  'screencast:stop': z.object({
    platform: z.string().optional()
  }),
  'screencast:frame': z.object({}),

  // Settings
  'settings:get': z.object({ key: z.string() }),
  'settings:update': z.object({ key: z.string(), value: z.string() }),
  'settings:log-path': z.object({}),

  // Update push events
  'update:available': z.object({
    version: z.string(),
    releaseNotes: z.string().optional()
  }),
  'update:ready': z.object({
    version: z.string()
  }),
  'update:download': z.object({}),
  'update:install': z.object({}),

  // Notification push event
  'notification:clicked': z.object({
    event: z.enum([
      'high_match_job',
      'application_complete',
      'application_failed',
      'circuit_breaker_tripped',
      'session_complete'
    ])
  }),

  // Config push event
  'config:changed': z.object({
    type: z.enum(['hints', 'settings', 'data'])
  }),

  // RPC pairing
  'rpc:pairing-info': z.object({}),

  // Shell (extension system)
  'shell:extensions': z.object({}),
  'shell:ext-enable': z.object({ id: z.string() }),
  'shell:ext-disable': z.object({ id: z.string() }),

  // AI Provider Registry
  'ai:complete': z.object({
    systemPrompt: z.string(),
    userMessage: z.string(),
    tier: z.enum(['fast', 'standard', 'premium']).optional(),
    maxTokens: z.number().optional(),
    task: z.string().optional(),
    providerId: z.string().optional()
  }),
  'ai:chat': z.object({
    systemPrompt: z.string(),
    messages: z.array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string()
      })
    ),
    tier: z.enum(['fast', 'standard', 'premium']).optional(),
    maxTokens: z.number().optional(),
    task: z.string().optional(),
    providerId: z.string().optional()
  }),
  'ai:providers': z.object({}),
  'ai:set-default': z.object({ providerId: z.string() }),
  'ai:stream': z.object({
    systemPrompt: z.string(),
    userMessage: z.string(),
    tier: z.enum(['fast', 'standard', 'premium']).optional(),
    maxTokens: z.number().optional(),
    task: z.string().optional(),
    providerId: z.string().optional()
  }),
  'ai:stream-chunk': z.object({
    delta: z.string(),
    done: z.boolean(),
    model: z.string().optional(),
    usage: z
      .object({
        inputTokens: z.number(),
        outputTokens: z.number()
      })
      .optional()
  }),

  // Schedules
  'schedule:list': z.object({}),
  'schedule:create': z.object({
    name: z.string().min(1),
    taskType: z.string().min(1),
    cronExpression: z.string().min(1),
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional()
  }),
  'schedule:update': z.object({
    id: z.string(),
    updates: z
      .object({
        name: z.string().min(1),
        cronExpression: z.string().min(1),
        enabled: z.boolean(),
        config: z.record(z.string(), z.unknown())
      })
      .partial()
  }),
  'schedule:delete': z.object({ id: z.string() }),
  'schedule:toggle': z.object({ id: z.string(), enabled: z.boolean() }),
  'schedule:trigger': z.object({ id: z.string() }),
  'schedule:run-start': z.object({ scheduleId: z.string() }),
  'schedule:run-complete': z.object({
    scheduleId: z.string(),
    status: z.enum(['success', 'error']),
    error: z.string().optional(),
    durationMs: z.number()
  }),
  'schedule:runs': z.object({
    scheduleId: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional()
  }),
  'scheduler:tools': z.object({}),

  // Skills
  'skill:list': z.object({
    category: z.enum(['document', 'communication', 'data', 'media', 'utility']).optional()
  }),
  'skill:execute': z.object({
    skillId: z.string().min(1),
    input: z.record(z.string(), z.unknown()).optional()
  }),
  'skill:info': z.object({
    skillId: z.string().min(1)
  }),
  'skill:enable': z.object({
    id: z.string().min(1)
  }),
  'skill:disable': z.object({
    id: z.string().min(1)
  }),

  // Skill Catalog
  'skill:catalog-list': z.object({
    category: z.enum(['document', 'communication', 'data', 'media', 'utility']).optional()
  }),
  'skill:catalog-install': z.object({
    skillId: z.string().min(1)
  }),
  'skill:catalog-uninstall': z.object({
    skillId: z.string().min(1)
  }),
  'skill:custom-create': z.object({
    displayName: z.string().min(1),
    description: z.string().min(1),
    category: z.enum(['document', 'communication', 'data', 'media', 'utility']).optional(),
    icon: z.string().optional(),
    content: z.string()
  }),
  'skill:custom-update': z.object({
    id: z.string().min(1),
    displayName: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    category: z.enum(['document', 'communication', 'data', 'media', 'utility']).optional(),
    icon: z.string().optional(),
    content: z.string().optional()
  }),
  'skill:custom-delete': z.object({
    skillId: z.string().min(1)
  })
} as const

export type IPCSchemas = typeof ipcSchemas
