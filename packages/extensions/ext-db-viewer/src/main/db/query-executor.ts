// ============================================================================
// ext-db-viewer — Query Executor
//
// Builds safe, parameterized SQL queries for table data access and CRUD.
// All table/column names are validated against the schema before use.
// ============================================================================

import type Database from 'better-sqlite3'
import {
  validateTableName,
  validateColumnName,
  getPrimaryKey,
  isVirtualTable
} from './schema-introspector'

export interface TableDataParams {
  table: string
  page: number
  pageSize: number
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  filters?: Array<{
    column: string
    operator: string
    value?: string
  }>
}

export interface TableDataResult {
  rows: Record<string, unknown>[]
  totalCount: number
  page: number
  pageSize: number
}

export interface SqlExecuteResult {
  columns: string[]
  rows: unknown[][]
  rowsAffected: number
  executionTimeMs: number
  statementType: string
}

const OPERATOR_MAP: Record<string, string> = {
  eq: '= ?',
  neq: '!= ?',
  like: 'LIKE ?',
  gt: '> ?',
  lt: '< ?',
  gte: '>= ?',
  lte: '<= ?',
  'is-null': 'IS NULL',
  'not-null': 'IS NOT NULL'
}

/** Query table data with pagination, sorting, and filtering. */
export function queryTableData(db: Database.Database, params: TableDataParams): TableDataResult {
  const { table, page, pageSize, sortColumn, sortDirection, filters } = params

  validateTableName(db, table)

  // Validate sort column
  if (sortColumn) {
    validateColumnName(db, table, sortColumn)
  }

  // Build WHERE clause
  const whereParts: string[] = []
  const whereParams: unknown[] = []

  if (filters && filters.length > 0) {
    for (const f of filters) {
      validateColumnName(db, table, f.column)
      const op = OPERATOR_MAP[f.operator]
      if (!op) throw new Error(`Invalid filter operator: ${f.operator}`)

      if (f.operator === 'is-null' || f.operator === 'not-null') {
        whereParts.push(`"${f.column}" ${op}`)
      } else {
        whereParts.push(`"${f.column}" ${op}`)
        const val = f.operator === 'like' ? `%${f.value ?? ''}%` : (f.value ?? '')
        whereParams.push(val)
      }
    }
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''

  // Count query
  const countSql = `SELECT COUNT(*) as cnt FROM "${table}" ${whereClause}`
  const countResult = db.prepare(countSql).get(...whereParams) as { cnt: number }
  const totalCount = countResult.cnt

  // Data query
  const orderClause =
    sortColumn && sortDirection ? `ORDER BY "${sortColumn}" ${sortDirection.toUpperCase()}` : ''
  const offset = (page - 1) * pageSize
  const dataSql = `SELECT * FROM "${table}" ${whereClause} ${orderClause} LIMIT ? OFFSET ?`
  const rows = db.prepare(dataSql).all(...whereParams, pageSize, offset) as Record<
    string,
    unknown
  >[]

  return { rows, totalCount, page, pageSize }
}

/** Update specific columns of a record identified by primary key. */
export function updateRecord(
  db: Database.Database,
  table: string,
  primaryKey: Record<string, unknown>,
  changes: Record<string, unknown>
): number {
  validateTableName(db, table)
  if (isVirtualTable(db, table)) throw new Error('Cannot modify virtual table')

  const changeKeys = Object.keys(changes)
  for (const col of changeKeys) validateColumnName(db, table, col)
  const pkKeys = Object.keys(primaryKey)
  for (const col of pkKeys) validateColumnName(db, table, col)

  const setParts = changeKeys.map((k) => `"${k}" = ?`)
  const whereParts = pkKeys.map((k) => `"${k}" = ?`)
  const params = [...changeKeys.map((k) => changes[k]), ...pkKeys.map((k) => primaryKey[k])]

  const sql = `UPDATE "${table}" SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`
  const result = db.prepare(sql).run(...params)
  return result.changes
}

/** Insert a new record into a table. */
export function insertRecord(
  db: Database.Database,
  table: string,
  values: Record<string, unknown>
): unknown {
  validateTableName(db, table)
  if (isVirtualTable(db, table)) throw new Error('Cannot modify virtual table')

  const keys = Object.keys(values)
  for (const col of keys) validateColumnName(db, table, col)

  const placeholders = keys.map(() => '?').join(', ')
  const cols = keys.map((k) => `"${k}"`).join(', ')
  const params = keys.map((k) => values[k])

  const sql = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`
  const result = db.prepare(sql).run(...params)
  return result.lastInsertRowid
}

/** Delete a record identified by primary key. */
export function deleteRecord(
  db: Database.Database,
  table: string,
  primaryKey: Record<string, unknown>
): number {
  validateTableName(db, table)
  if (isVirtualTable(db, table)) throw new Error('Cannot modify virtual table')

  const pkKeys = Object.keys(primaryKey)
  for (const col of pkKeys) validateColumnName(db, table, col)

  const whereParts = pkKeys.map((k) => `"${k}" = ?`)
  const params = pkKeys.map((k) => primaryKey[k])

  const sql = `DELETE FROM "${table}" WHERE ${whereParts.join(' AND ')}`
  const result = db.prepare(sql).run(...params)
  return result.changes
}

/** Execute raw SQL (dev-mode only). Adds LIMIT safeguard to unbounded SELECTs. */
export function executeSql(
  db: Database.Database,
  sql: string,
  params?: unknown[]
): SqlExecuteResult {
  const trimmed = sql.trim()
  const statementType = detectStatementType(trimmed)
  const start = performance.now()

  if (statementType === 'SELECT') {
    // Add LIMIT safeguard if no LIMIT clause present
    const safeSql = /\bLIMIT\b/i.test(trimmed) ? trimmed : `${trimmed} LIMIT 1000`
    const stmt = db.prepare(safeSql)
    const rows = params ? stmt.all(...params) : stmt.all()
    const executionTimeMs = Math.round(performance.now() - start)

    const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : []
    const rowArrays = rows.map((r) => columns.map((c) => (r as Record<string, unknown>)[c]))

    return { columns, rows: rowArrays, rowsAffected: 0, executionTimeMs, statementType }
  }

  // Mutating statement
  const stmt = db.prepare(trimmed)
  const result = params ? stmt.run(...params) : stmt.run()
  const executionTimeMs = Math.round(performance.now() - start)

  return { columns: [], rows: [], rowsAffected: result.changes, executionTimeMs, statementType }
}

function detectStatementType(sql: string): string {
  const first = sql.split(/\s+/)[0].toUpperCase()
  const known = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'PRAGMA']
  return known.includes(first) ? first : 'UNKNOWN'
}

export { getPrimaryKey }
