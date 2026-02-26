// ============================================================================
// ext-db-viewer — Data Import
//
// Import data from CSV or JSON files with preview and validation.
// ============================================================================

import { readFileSync } from 'fs'
import type Database from 'better-sqlite3'
import { validateTableName, getColumns } from './schema-introspector'

export interface ImportColumn {
  name: string
  matched: boolean
  targetType: string | null
}

export interface ImportPreviewResult {
  columns: ImportColumn[]
  previewRows: unknown[][]
  totalRows: number
  warnings: string[]
}

export interface ImportExecuteResult {
  importedCount: number
  skippedCount: number
  errors: Array<{ row: number; error: string }>
}

/** Preview an import file: parse and match columns against the target table. */
export function previewImport(
  db: Database.Database,
  table: string,
  filePath: string,
  format: 'csv' | 'json'
): ImportPreviewResult {
  validateTableName(db, table)
  const tableColumns = getColumns(db, table)
  const tableColMap = new Map(tableColumns.map((c) => [c.name, c.type]))

  const { headers, rows } = parseFile(filePath, format)
  const warnings: string[] = []

  const columns: ImportColumn[] = headers.map((h) => {
    const matched = tableColMap.has(h)
    if (!matched) warnings.push(`Column "${h}" not found in table "${table}"`)
    return { name: h, matched, targetType: tableColMap.get(h) ?? null }
  })

  // Check for required columns (NOT NULL without default) not in the file
  for (const col of tableColumns) {
    if (col.notnull && !col.defaultValue && !col.isPrimaryKey && !headers.includes(col.name)) {
      warnings.push(`Required column "${col.name}" (NOT NULL) missing from import file`)
    }
  }

  const previewRows = rows.slice(0, 100).map((row) => headers.map((h) => row[h]))

  return { columns, previewRows, totalRows: rows.length, warnings }
}

/** Execute an import into the target table within a transaction. */
export function executeImport(
  db: Database.Database,
  table: string,
  filePath: string,
  format: 'csv' | 'json',
  columnMapping?: Record<string, string>
): ImportExecuteResult {
  validateTableName(db, table)
  const { headers, rows } = parseFile(filePath, format)

  // Map source columns to target columns
  const mapping = new Map<string, string>()
  for (const h of headers) {
    const target = columnMapping?.[h] ?? h
    mapping.set(h, target)
  }

  // Filter to only columns that exist in the target table
  const tableColumns = getColumns(db, table)
  const validCols = new Set(tableColumns.map((c) => c.name))
  const targetHeaders = headers.filter((h) => validCols.has(mapping.get(h)!))

  if (targetHeaders.length === 0) {
    return {
      importedCount: 0,
      skippedCount: rows.length,
      errors: [{ row: 0, error: 'No matching columns found' }]
    }
  }

  const cols = targetHeaders.map((h) => `"${mapping.get(h)!}"`).join(', ')
  const placeholders = targetHeaders.map(() => '?').join(', ')
  const sql = `INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`

  let importedCount = 0
  let skippedCount = 0
  const errors: Array<{ row: number; error: string }> = []

  const insertStmt = db.prepare(sql)
  const transaction = db.transaction(() => {
    for (let i = 0; i < rows.length; i++) {
      try {
        const params = targetHeaders.map((h) => {
          const val = rows[i][h]
          return val === undefined || val === '' ? null : val
        })
        insertStmt.run(...params)
        importedCount++
      } catch (err) {
        skippedCount++
        errors.push({ row: i + 1, error: String(err) })
        if (errors.length > 50) break // stop collecting after 50 errors
      }
    }
  })

  try {
    transaction()
  } catch (err) {
    return {
      importedCount: 0,
      skippedCount: rows.length,
      errors: [{ row: 0, error: `Transaction failed: ${err}` }]
    }
  }

  return { importedCount, skippedCount, errors }
}

/** Parse a CSV or JSON file into headers and row objects. */
function parseFile(
  filePath: string,
  format: 'csv' | 'json'
): { headers: string[]; rows: Record<string, unknown>[] } {
  const content = readFileSync(filePath, 'utf-8')

  if (format === 'json') {
    const data = JSON.parse(content)
    if (!Array.isArray(data)) throw new Error('JSON file must contain an array')
    if (data.length === 0) return { headers: [], rows: [] }
    const headers = Object.keys(data[0])
    return { headers, rows: data }
  }

  // CSV parsing
  const lines = parseCsvLines(content)
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = lines[0]
  const rows = lines.slice(1).map((fields) => {
    const row: Record<string, unknown> = {}
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = fields[i] ?? null
    }
    return row
  })

  return { headers, rows }
}

/** Parse CSV content respecting RFC 4180 quoting. */
function parseCsvLines(content: string): string[][] {
  const lines: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const ch = content[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          field += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        current.push(field)
        field = ''
      } else if (ch === '\n' || (ch === '\r' && content[i + 1] === '\n')) {
        current.push(field)
        field = ''
        lines.push(current)
        current = []
        if (ch === '\r') i++ // skip \n in \r\n
      } else {
        field += ch
      }
    }
  }

  // Last field/line
  if (field || current.length > 0) {
    current.push(field)
    lines.push(current)
  }

  return lines
}
