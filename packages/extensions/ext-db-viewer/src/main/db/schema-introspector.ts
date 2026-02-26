// ============================================================================
// ext-db-viewer — Schema Introspector
//
// Wraps SQLite introspection queries (sqlite_master, PRAGMA table_info, etc.)
// All table/column names are validated before use to prevent SQL injection.
// ============================================================================

import type Database from 'better-sqlite3'

export interface TableInfo {
  name: string
  type: 'table' | 'view' | 'virtual'
  rowCount: number
  isSystem: boolean
}

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notnull: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
}

export interface IndexInfo {
  name: string
  unique: boolean
  columns: string[]
}

const SYSTEM_TABLES = new Set(['_migrations', '_ext_migrations'])

/** List all tables in the database with row counts and type classification. */
export function listTables(db: Database.Database): TableInfo[] {
  const rows = db
    .prepare(
      `SELECT name, type, sql FROM sqlite_master
       WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    )
    .all() as Array<{ name: string; type: string; sql: string | null }>

  return rows.map((row) => {
    const isVirtual = row.sql ? /\bUSING\b/i.test(row.sql) : false
    let rowCount = 0
    try {
      const result = db.prepare(`SELECT COUNT(*) as cnt FROM "${row.name}"`).get() as {
        cnt: number
      }
      rowCount = result.cnt
    } catch {
      // Virtual tables may not support COUNT(*)
    }

    return {
      name: row.name,
      type: isVirtual ? 'virtual' : (row.type as 'table' | 'view'),
      rowCount,
      isSystem: SYSTEM_TABLES.has(row.name)
    }
  })
}

/** Get column info for a specific table. Validates table name first. */
export function getColumns(db: Database.Database, table: string): ColumnInfo[] {
  validateTableName(db, table)
  const rows = db.pragma(`table_info("${table}")`) as Array<{
    cid: number
    name: string
    type: string
    notnull: number
    dflt_value: string | null
    pk: number
  }>

  return rows.map((r) => ({
    cid: r.cid,
    name: r.name,
    type: r.type,
    notnull: r.notnull === 1,
    defaultValue: r.dflt_value,
    isPrimaryKey: r.pk > 0
  }))
}

/** Get indexes for a specific table. Validates table name first. */
export function getIndexes(db: Database.Database, table: string): IndexInfo[] {
  validateTableName(db, table)
  const indexes = db.pragma(`index_list("${table}")`) as Array<{
    seq: number
    name: string
    unique: number
    origin: string
    partial: number
  }>

  return indexes.map((idx) => {
    const cols = db.pragma(`index_info("${idx.name}")`) as Array<{
      seqno: number
      cid: number
      name: string
    }>
    return {
      name: idx.name,
      unique: idx.unique === 1,
      columns: cols.map((c) => c.name)
    }
  })
}

/** Get primary key columns for a table. Returns column names or ['rowid'] if no explicit PK. */
export function getPrimaryKey(db: Database.Database, table: string): string[] {
  const columns = getColumns(db, table)
  const pkCols = columns.filter((c) => c.isPrimaryKey).sort((a, b) => a.cid - b.cid)
  if (pkCols.length > 0) return pkCols.map((c) => c.name)
  return ['rowid']
}

/** Get valid column names for a table. */
export function getColumnNames(db: Database.Database, table: string): Set<string> {
  return new Set(getColumns(db, table).map((c) => c.name))
}

/** Validate that a table name exists in the database. Throws if invalid. */
export function validateTableName(db: Database.Database, table: string): void {
  const result = db
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE name = ? AND type IN ('table', 'view') LIMIT 1`
    )
    .get(table) as { '1': number } | undefined

  if (!result) {
    throw new Error(`Invalid table name: ${table}`)
  }
}

/** Validate that a column name exists in the given table. Throws if invalid. */
export function validateColumnName(db: Database.Database, table: string, column: string): void {
  const names = getColumnNames(db, table)
  // Allow 'rowid' as a special pseudo-column
  if (!names.has(column) && column !== 'rowid') {
    throw new Error(`Invalid column name: ${column} (table: ${table})`)
  }
}

/** Check if a table is a virtual table (e.g. FTS5). */
export function isVirtualTable(db: Database.Database, table: string): boolean {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE name = ? AND type = 'table' LIMIT 1`)
    .get(table) as { sql: string | null } | undefined
  if (!row || !row.sql) return false
  return /\bUSING\b/i.test(row.sql)
}
