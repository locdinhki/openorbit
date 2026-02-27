// ============================================================================
// OpenOrbit — Data Format Skill
//
// Convert data between JSON and CSV formats. Supports JSON → CSV,
// CSV → JSON, and pretty-print JSON.
// ============================================================================

import type { Skill, SkillResult } from '../skill-types'

export function createFormatSkill(extensionId: string): Skill {
  return {
    id: 'data-format',
    displayName: 'Data Formatter',
    description:
      'Convert data between formats: JSON to CSV, CSV to JSON, or pretty-print JSON. Useful for exporting and transforming tabular data.',
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
          type: 'string',
          description: 'Input data as a JSON string or CSV string'
        },
        from: {
          type: 'string',
          description: 'Source format',
          enum: ['json', 'csv']
        },
        to: {
          type: 'string',
          description: 'Target format',
          enum: ['json', 'csv', 'pretty-json']
        }
      },
      required: ['data', 'from', 'to']
    },
    outputSchema: {
      type: 'object',
      description: 'Formatted output',
      properties: {
        formatted: { type: 'string', description: 'The formatted output string' },
        rowCount: { type: 'number', description: 'Number of data rows' }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const data = input.data as string
      const from = input.from as string
      const to = input.to as string

      if (!data || typeof data !== 'string') {
        return { success: false, error: 'Missing or invalid data' }
      }
      if (!from || !['json', 'csv'].includes(from)) {
        return { success: false, error: 'Invalid source format (expected "json" or "csv")' }
      }
      if (!to || !['json', 'csv', 'pretty-json'].includes(to)) {
        return {
          success: false,
          error: 'Invalid target format (expected "json", "csv", or "pretty-json")'
        }
      }

      try {
        let rows: Record<string, unknown>[]

        if (from === 'json') {
          const parsed = JSON.parse(data)
          rows = Array.isArray(parsed) ? parsed : [parsed]
        } else {
          rows = csvToJson(data)
        }

        let formatted: string
        if (to === 'csv') {
          formatted = jsonToCsv(rows)
        } else if (to === 'pretty-json') {
          formatted = JSON.stringify(rows, null, 2)
        } else {
          formatted = JSON.stringify(rows)
        }

        return {
          success: true,
          data: { formatted, rowCount: rows.length },
          summary: `Converted ${rows.length} row${rows.length === 1 ? '' : 's'} from ${from} to ${to}`
        }
      } catch (err) {
        return {
          success: false,
          error: `Format conversion failed: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CSV ↔ JSON converters
// ---------------------------------------------------------------------------

/** Parse CSV string to array of objects. Handles quoted fields per RFC 4180. */
export function csvToJson(csv: string): Record<string, unknown>[] {
  const lines = parseCsvLines(csv)
  if (lines.length < 2) return []

  const headers = lines[0]
  const rows: Record<string, unknown>[] = []

  for (let i = 1; i < lines.length; i++) {
    const row: Record<string, unknown> = {}
    const fields = lines[i]
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = fields[j] ?? ''
    }
    rows.push(row)
  }

  return rows
}

/** Convert array of objects to CSV string. */
export function jsonToCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''

  // Collect all unique keys as headers
  const headerSet = new Set<string>()
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      headerSet.add(key)
    }
  }
  const headers = [...headerSet]

  const lines: string[] = [headers.map(escapeCsvField).join(',')]

  for (const row of rows) {
    const fields = headers.map((h) => escapeCsvField(String(row[h] ?? '')))
    lines.push(fields.join(','))
  }

  return lines.join('\n')
}

/** Escape a CSV field per RFC 4180: wrap in quotes if it contains commas, quotes, or newlines. */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Parse CSV text into a 2D array of fields, handling quoted fields. */
function parseCsvLines(csv: string): string[][] {
  const result: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csv.length && csv[i + 1] === '"') {
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
        row.push(field)
        field = ''
      } else if (ch === '\n') {
        row.push(field)
        field = ''
        if (row.some((f) => f.length > 0)) {
          result.push(row)
        }
        row = []
      } else if (ch === '\r') {
        // skip carriage return
      } else {
        field += ch
      }
    }
  }

  // Last field/row
  row.push(field)
  if (row.some((f) => f.length > 0)) {
    result.push(row)
  }

  return result
}
