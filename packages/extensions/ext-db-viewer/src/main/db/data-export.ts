// ============================================================================
// ext-db-viewer — Data Export
//
// Export table data to CSV or JSON format.
// ============================================================================

import { writeFileSync } from 'fs'
import type Database from 'better-sqlite3'
import { validateTableName, getColumns } from './schema-introspector'

export interface ExportResult {
  path: string
  rowCount: number
}

/** Export a table to a file in the given format. */
export function exportTable(
  db: Database.Database,
  table: string,
  format: 'csv' | 'json',
  outputPath: string,
  limit?: number
): ExportResult {
  validateTableName(db, table)

  const limitClause = limit ? `LIMIT ${limit}` : ''
  const rows = db.prepare(`SELECT * FROM "${table}" ${limitClause}`).all() as Record<
    string,
    unknown
  >[]

  if (format === 'csv') {
    const columns = getColumns(db, table).map((c) => c.name)
    const lines: string[] = [columns.map(escapeCsvField).join(',')]

    for (const row of rows) {
      const values = columns.map((col) => {
        const val = row[col]
        if (val === null || val === undefined) return ''
        return escapeCsvField(String(val))
      })
      lines.push(values.join(','))
    }

    writeFileSync(outputPath, lines.join('\n'), 'utf-8')
  } else {
    writeFileSync(outputPath, JSON.stringify(rows, null, 2), 'utf-8')
  }

  return { path: outputPath, rowCount: rows.length }
}

/** Escape a field for CSV per RFC 4180. */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
