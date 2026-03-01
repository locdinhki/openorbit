// ============================================================================
// OpenOrbit — Spreadsheet Export Skill
//
// Export tabular data to Excel (.xlsx) or CSV format using exceljs.
// Supports auto-headers, number/date formatting, multiple sheets, and formulas.
// ============================================================================

import { writeFile, mkdir } from 'fs/promises'
import { dirname, resolve } from 'path'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import type { Skill, SkillResult } from '../skill-types'

// Dynamic import for exceljs (optional dependency)
async function getExcelJS(): Promise<typeof import('exceljs')> {
  const mod = await import('exceljs')
  return mod.default ?? mod
}

export interface SpreadsheetColumn {
  key: string
  header?: string
  width?: number
  type?: 'string' | 'number' | 'date' | 'boolean' | 'formula'
  format?: string // Number format (e.g., '$#,##0.00', '0.00%')
}

export interface SpreadsheetSheet {
  name: string
  data: Record<string, unknown>[]
  columns?: SpreadsheetColumn[]
}

export function createSpreadsheetSkill(extensionId: string): Skill {
  return {
    id: 'spreadsheet-export',
    displayName: 'Spreadsheet Export',
    icon: 'table',
    description:
      'Export tabular data to Excel (.xlsx) or CSV format. Supports multiple sheets, auto-detected headers, number/date formatting, column widths, and basic formulas.',
    category: 'data',
    extensionId,
    capabilities: {
      aiTool: true,
      offlineCapable: true,
      streaming: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description:
            'Array of objects to export. Each object becomes a row, keys become columns.',
          items: { type: 'object' }
        },
        sheets: {
          type: 'array',
          description:
            'For multi-sheet workbooks, provide an array of sheet definitions instead of "data".',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Sheet name' },
              data: { type: 'array', description: 'Array of row objects' },
              columns: {
                type: 'array',
                description: 'Column definitions (optional)',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string', description: 'Property key' },
                    header: { type: 'string', description: 'Column header' },
                    width: { type: 'number', description: 'Column width' },
                    type: {
                      type: 'string',
                      description: 'Data type: string, number, date, boolean'
                    },
                    format: {
                      type: 'string',
                      description: 'Number format string'
                    }
                  }
                }
              }
            }
          }
        },
        columns: {
          type: 'array',
          description:
            'Column definitions for single-sheet export. If omitted, auto-detects from data keys.',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Property key in data' },
              header: {
                type: 'string',
                description: 'Column header (defaults to key)'
              },
              width: {
                type: 'number',
                description: 'Column width (default: auto)'
              },
              type: {
                type: 'string',
                description: 'Data type: string, number, date, boolean, formula'
              },
              format: {
                type: 'string',
                description: 'Number format (e.g., "$#,##0.00")'
              }
            }
          }
        },
        format: {
          type: 'string',
          description: 'Output format',
          enum: ['xlsx', 'csv']
        },
        sheetName: {
          type: 'string',
          description: 'Sheet name for single-sheet export (default: "Sheet1")'
        },
        outputPath: {
          type: 'string',
          description: 'Output file path. If omitted, generates a temp file.'
        },
        includeHeaders: {
          type: 'boolean',
          description: 'Include header row (default: true)'
        },
        autoFilter: {
          type: 'boolean',
          description: 'Add auto-filter to header row (xlsx only, default: false)'
        },
        freezeHeader: {
          type: 'boolean',
          description: 'Freeze header row (xlsx only, default: false)'
        }
      },
      required: []
    },
    outputSchema: {
      type: 'object',
      description: 'Export result',
      properties: {
        filePath: { type: 'string', description: 'Path to exported file' },
        rowCount: { type: 'number', description: 'Total rows exported' },
        sheetCount: { type: 'number', description: 'Number of sheets' },
        format: { type: 'string', description: 'Output format used' },
        sizeBytes: { type: 'number', description: 'File size in bytes' }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const format = (input.format as 'xlsx' | 'csv') ?? 'xlsx'
      const includeHeaders = input.includeHeaders !== false
      const autoFilter = input.autoFilter === true
      const freezeHeader = input.freezeHeader === true
      let outputPath = input.outputPath as string | undefined

      // Determine sheets to process
      let sheets: SpreadsheetSheet[]

      if (input.sheets && Array.isArray(input.sheets)) {
        sheets = input.sheets as SpreadsheetSheet[]
      } else if (input.data && Array.isArray(input.data)) {
        sheets = [
          {
            name: (input.sheetName as string) ?? 'Sheet1',
            data: input.data as Record<string, unknown>[],
            columns: input.columns as SpreadsheetColumn[] | undefined
          }
        ]
      } else {
        return {
          success: false,
          error: 'Either "data" (array) or "sheets" (array) is required'
        }
      }

      if (sheets.length === 0) {
        return { success: false, error: 'No sheets to export' }
      }

      try {
        const ExcelJS = await getExcelJS()
        const workbook = new ExcelJS.Workbook()
        workbook.creator = 'OpenOrbit'
        workbook.created = new Date()

        let totalRows = 0

        for (const sheet of sheets) {
          const ws = workbook.addWorksheet(sheet.name || 'Sheet')
          const data = sheet.data || []

          if (data.length === 0) continue

          // Auto-detect columns from first row if not provided
          const columns: SpreadsheetColumn[] =
            sheet.columns ??
            Object.keys(data[0]).map((key) => ({
              key,
              header: key
            }))

          // Set up columns
          ws.columns = columns.map((col) => ({
            key: col.key,
            header: col.header ?? col.key,
            width: col.width ?? Math.max(10, (col.header ?? col.key).length + 2)
          }))

          // Add data rows
          for (const row of data) {
            const rowData: Record<string, unknown> = {}
            for (const col of columns) {
              let value = row[col.key]

              // Handle type conversions
              if (col.type === 'number' && typeof value === 'string') {
                const parsed = parseFloat(value)
                if (!isNaN(parsed)) value = parsed
              } else if (col.type === 'date' && typeof value === 'string') {
                const parsed = new Date(value)
                if (!isNaN(parsed.getTime())) value = parsed
              } else if (col.type === 'boolean') {
                value = Boolean(value)
              }

              rowData[col.key] = value
            }
            ws.addRow(rowData)
          }

          // Apply formatting
          if (includeHeaders) {
            const headerRow = ws.getRow(1)
            headerRow.font = { bold: true }
            headerRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE0E0E0' }
            }
          }

          // Apply number formats to columns
          for (let i = 0; i < columns.length; i++) {
            const col = columns[i]
            if (col.format) {
              const wsCol = ws.getColumn(i + 1)
              wsCol.numFmt = col.format
            }
          }

          // Auto-filter
          if (autoFilter && format === 'xlsx' && data.length > 0) {
            ws.autoFilter = {
              from: { row: 1, column: 1 },
              to: { row: data.length + 1, column: columns.length }
            }
          }

          // Freeze header row
          if (freezeHeader && format === 'xlsx') {
            ws.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }]
          }

          totalRows += data.length
        }

        // Determine output path
        if (!outputPath) {
          const ext = format === 'csv' ? 'csv' : 'xlsx'
          outputPath = resolve(tmpdir(), `openorbit-export-${randomUUID()}.${ext}`)
        }

        // Ensure directory exists
        await mkdir(dirname(outputPath), { recursive: true })

        // Write file
        let sizeBytes: number

        if (format === 'csv') {
          // CSV only exports first sheet
          const csvBuffer = await workbook.csv.writeBuffer()
          const buffer = Buffer.from(csvBuffer)
          await writeFile(outputPath, buffer)
          sizeBytes = buffer.length
        } else {
          const buffer = (await workbook.xlsx.writeBuffer()) as Buffer
          await writeFile(outputPath, buffer)
          sizeBytes = buffer.length
        }

        return {
          success: true,
          data: {
            filePath: outputPath,
            rowCount: totalRows,
            sheetCount: sheets.length,
            format,
            sizeBytes
          },
          summary: `Exported ${totalRows} rows to ${format.toUpperCase()} (${Math.round(sizeBytes / 1024)}KB)`
        }
      } catch (err) {
        return {
          success: false,
          error: `Spreadsheet export failed: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }
  }
}
