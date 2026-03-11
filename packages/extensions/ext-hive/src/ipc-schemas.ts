// ============================================================================
// ext-hive — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

export const extHiveSchemas = {
  'ext-hive:list-devices': z.object({}),

  'ext-hive:get-device': z.object({
    id: z.string().min(1)
  }),

  'ext-hive:dispatch-task': z.object({
    targetDevice: z.string().min(1),
    instruction: z.object({
      type: z.enum(['exec', 'read', 'write', 'http']),
      command: z.string().optional(),
      cwd: z.string().optional(),
      timeout: z.number().optional(),
      path: z.string().optional(),
      content: z.string().optional(),
      encoding: z.string().optional(),
      mode: z.string().optional(),
      method: z.string().optional(),
      url: z.string().optional(),
      headers: z.record(z.string()).optional(),
      body: z.string().optional()
    }),
    priority: z.enum(['low', 'normal', 'high', 'critical']).default('normal')
  }),

  'ext-hive:get-task': z.object({
    id: z.string().min(1)
  }),

  'ext-hive:list-tasks': z.object({
    deviceId: z.string().optional(),
    status: z.string().optional(),
    limit: z.number().int().min(1).max(500).default(100)
  }),

  'ext-hive:health': z.object({}),

  'ext-hive:list-schedules': z.object({
    deviceId: z.string().optional()
  }),

  'ext-hive:create-schedule': z.object({
    deviceId: z.string().min(1),
    name: z.string().min(1),
    instruction: z.record(z.unknown()),
    cronExpression: z.string().min(1)
  }),

  'ext-hive:update-schedule': z.object({
    id: z.string().min(1),
    updates: z.record(z.unknown())
  }),

  'ext-hive:delete-schedule': z.object({
    id: z.string().min(1)
  }),

  'ext-hive:chat-send': z.object({
    message: z.string().min(1)
  }),

  'ext-hive:chat-clear': z.object({})
} as const
