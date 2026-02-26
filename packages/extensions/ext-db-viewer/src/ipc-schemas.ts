// ============================================================================
// ext-db-viewer — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

const FilterOperator = z.enum([
  'eq',
  'neq',
  'like',
  'gt',
  'lt',
  'gte',
  'lte',
  'is-null',
  'not-null'
])

export const extDbViewerSchemas = {
  // Schema
  'ext-db-viewer:schema-tables': z.object({}),
  'ext-db-viewer:schema-columns': z.object({ table: z.string().min(1) }),
  'ext-db-viewer:schema-indexes': z.object({ table: z.string().min(1) }),

  // Data
  'ext-db-viewer:table-data': z.object({
    table: z.string().min(1),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(500).default(50),
    sortColumn: z.string().optional(),
    sortDirection: z.enum(['asc', 'desc']).optional(),
    filters: z
      .array(
        z.object({
          column: z.string(),
          operator: FilterOperator,
          value: z.string().optional()
        })
      )
      .optional()
  }),

  // CRUD
  'ext-db-viewer:record-update': z.object({
    table: z.string().min(1),
    primaryKey: z.record(z.string(), z.unknown()),
    changes: z.record(z.string(), z.unknown())
  }),
  'ext-db-viewer:record-insert': z.object({
    table: z.string().min(1),
    values: z.record(z.string(), z.unknown())
  }),
  'ext-db-viewer:record-delete': z.object({
    table: z.string().min(1),
    primaryKey: z.record(z.string(), z.unknown())
  }),

  // SQL Console
  'ext-db-viewer:sql-execute': z.object({
    sql: z.string().min(1).max(10000),
    params: z.array(z.unknown()).optional()
  }),
  'ext-db-viewer:dev-mode': z.object({
    action: z.enum(['get', 'set']),
    enabled: z.boolean().optional()
  }),

  // Export/Import
  'ext-db-viewer:export-table': z.object({
    table: z.string().min(1),
    format: z.enum(['csv', 'json']),
    limit: z.number().int().min(1).optional()
  }),
  'ext-db-viewer:import-select': z.object({
    format: z.enum(['csv', 'json'])
  }),
  'ext-db-viewer:import-preview': z.object({
    table: z.string().min(1),
    filePath: z.string().min(1),
    format: z.enum(['csv', 'json'])
  }),
  'ext-db-viewer:import-execute': z.object({
    table: z.string().min(1),
    filePath: z.string().min(1),
    format: z.enum(['csv', 'json']),
    columnMapping: z.record(z.string(), z.string()).optional()
  })
} as const
