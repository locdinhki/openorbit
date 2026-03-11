import {
  pgTable,
  text,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
  integer,
  real
} from 'drizzle-orm/pg-core'

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
  minionVersion: text('minion_version'),
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

export const schedules = pgTable('schedules', {
  id: text('id').primaryKey(),
  deviceId: text('device_id')
    .notNull()
    .references(() => devices.id),
  name: text('name').notNull(),
  instruction: jsonb('instruction').$type<Record<string, unknown>>().notNull(),
  cronExpression: text('cron_expression').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const workflowRunStatusEnum = pgEnum('workflow_run_status', [
  'pending',
  'running',
  'completed',
  'failed'
])

export const workflows = pgTable('workflows', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  steps: jsonb('steps').$type<WorkflowStep[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const workflowRuns = pgTable('workflow_runs', {
  id: text('id').primaryKey(),
  workflowId: text('workflow_id')
    .notNull()
    .references(() => workflows.id),
  status: workflowRunStatusEnum('status').notNull().default('pending'),
  currentStep: integer('current_step').notNull().default(0),
  context: jsonb('context').$type<Record<string, string>>().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const workflowStepRuns = pgTable('workflow_step_runs', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => workflowRuns.id),
  stepIndex: integer('step_index').notNull(),
  taskId: text('task_id').references(() => tasks.id),
  status: workflowRunStatusEnum('status').notNull().default('pending'),
  output: jsonb('output').$type<Record<string, unknown>>(),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true })
})

export interface WorkflowStep {
  name: string
  deviceId: string
  instruction: Record<string, unknown>
  onSuccess?: number | null // step index to jump to (null = next)
  onFailure?: number | null // step index to jump to on failure (null = abort)
  passOutputAs?: string // variable name — stdout stored here, injectable as ${VAR}
}

export const deviceGroups = pgTable('device_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  tagFilter: text('tag_filter').notNull(), // matches devices where locationTag equals this value
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// ── Phase 11: Monitoring + Alerts ─────────────────────────────────────────

export const deviceMetrics = pgTable('device_metrics', {
  id: text('id').primaryKey(),
  deviceId: text('device_id')
    .notNull()
    .references(() => devices.id),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  cpuPercent: real('cpu_percent'),
  memPercent: real('mem_percent'),
  memUsedMb: integer('mem_used_mb'),
  memTotalMb: integer('mem_total_mb')
})

export const alertRules = pgTable('alert_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  deviceId: text('device_id').references(() => devices.id), // null = all devices
  metric: text('metric').notNull(), // 'cpu' | 'mem' | 'offline'
  threshold: real('threshold').notNull().default(90), // percent for cpu/mem; 0 for offline
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

export const alerts = pgTable('alerts', {
  id: text('id').primaryKey(),
  ruleId: text('rule_id')
    .notNull()
    .references(() => alertRules.id),
  deviceId: text('device_id')
    .notNull()
    .references(() => devices.id),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  notified: boolean('notified').notNull().default(false),
  message: text('message')
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
