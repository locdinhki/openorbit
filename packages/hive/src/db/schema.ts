import { pgTable, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core'

// ── Enums ────────────────────────────────────────────────────────────────────

export const deviceStatusEnum = pgEnum('device_status', ['online', 'offline', 'busy'])
export const deviceTypeEnum = pgEnum('device_type', ['minion', 'controller'])
export const taskStatusEnum = pgEnum('task_status', [
  'queued',
  'dispatched',
  'running',
  'completed',
  'failed',
  'timeout'
])
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'normal', 'high', 'critical'])
export const resultStatusEnum = pgEnum('result_status', ['success', 'error', 'timeout'])

// ── Tables ───────────────────────────────────────────────────────────────────

export const devices = pgTable('devices', {
  id: text('id').primaryKey(),
  hardwareId: text('hardware_id').unique(),
  apiKeyHash: text('api_key_hash').notNull(),
  name: text('name').notNull(),
  type: deviceTypeEnum('type').notNull().default('minion'),
  capabilities: jsonb('capabilities').$type<string[]>().default([]),
  locationTag: text('location_tag'),
  status: deviceStatusEnum('status').notNull().default('offline'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  ipAddress: text('ip_address'),
  hardwareInfo: jsonb('hardware_info').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  createdBy: text('created_by').references(() => devices.id),
  targetDevice: text('target_device').references(() => devices.id),
  priority: taskPriorityEnum('priority').notNull().default('normal'),
  status: taskStatusEnum('status').notNull().default('queued'),
  instruction: jsonb('instruction').$type<Record<string, unknown>>().notNull(),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const taskResults = pgTable('task_results', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id),
  deviceId: text('device_id')
    .notNull()
    .references(() => devices.id),
  status: resultStatusEnum('status').notNull(),
  result: jsonb('result').$type<Record<string, unknown>>(),
  error: text('error'),
  durationMs: text('duration_ms'), // stored as text, parsed as number
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})
