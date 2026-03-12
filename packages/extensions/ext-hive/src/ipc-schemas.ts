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

  'ext-hive:chat-clear': z.object({}),

  'ext-hive:open-terminal': z.object({
    deviceId: z.string().min(1)
  }),

  // Templates
  'ext-hive:list-templates': z.object({}),

  'ext-hive:create-template': z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    deviceId: z.string().optional(),
    instruction: z.record(z.unknown())
  }),

  'ext-hive:delete-template': z.object({
    id: z.string().min(1)
  }),

  'ext-hive:run-template': z.object({
    id: z.string().min(1),
    deviceId: z.string().optional()
  }),

  // Triggers
  'ext-hive:list-triggers': z.object({}),

  'ext-hive:create-trigger': z.object({
    name: z.string().min(1),
    condition: z.string().min(1),
    conditionParams: z.record(z.unknown()).optional(),
    action: z.string().min(1),
    actionParams: z.record(z.unknown()),
    cooldownS: z.number().int().optional()
  }),

  'ext-hive:delete-trigger': z.object({
    id: z.string().min(1)
  }),

  // Health Checks
  'ext-hive:list-health-checks': z.object({
    deviceId: z.string().optional()
  }),

  'ext-hive:create-health-check': z.object({
    deviceId: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['http', 'command']),
    url: z.string().optional(),
    command: z.string().optional(),
    runFrom: z.enum(['hive', 'device']).optional(),
    intervalS: z.number().int().optional()
  }),

  // Fleet Reports
  'ext-hive:generate-report': z.object({}),

  'ext-hive:get-latest-report': z.object({})
} as const
