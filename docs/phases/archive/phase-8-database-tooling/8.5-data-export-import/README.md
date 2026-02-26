# 8.5: Data Export/Import

**Effort:** Moderate | **Status:** Not started

## Background

Users and developers need to get data out of and into the database — exporting for analysis or backup, importing to restore or seed data. Export supports CSV and JSON formats. Import includes a preview step with column matching and validation before committing.

## How It Works

```
Export Flow
    DataToolbar "Export" button
        |
        |-- ExportDialog (format, row limit)
        |       |
        |       |--invoke ext-db-viewer:export-table --> data-export.ts
        |       |   { table, format: 'csv'|'json' }  |   |-- dialog.showSaveDialog()
        |       |                                     |   |-- write file
        |       |<-- { path, rowCount } --------------|

Import Flow
    DataToolbar "Import" button
        |
        |-- invoke ext-db-viewer:import-select -----> dialog.showOpenDialog()
        |<-- { filePath } ----------------------------|
        |
        |-- ImportDialog
        |       |
        |       |--invoke ext-db-viewer:import-preview --> data-import.ts
        |       |   { table, filePath, format }        |   |-- parse first 100 rows
        |       |                                      |   |-- match columns to table schema
        |       |<-- { columns[], previewRows[],       |
        |       |      totalRows, warnings[] }         |
        |       |
        |       |-- ImportPreview (column mapping, preview, warnings)
        |               |
        |               |--invoke ext-db-viewer:import-execute --> data-import.ts
        |               |   { table, filePath, format,         |   |-- parse all rows
        |               |     columnMapping? }                 |   |-- BEGIN TRANSACTION
        |               |                                      |   |-- INSERT each row
        |               |<-- { importedCount, skippedCount,    |   |-- COMMIT or ROLLBACK
        |                      errors[] }                      |
```

## Tasks

### Data Export
- [ ] Create `src/main/db/data-export.ts`:
  - `exportTable(db, table, format, limit?)` → `{ path, rowCount }`
  - CSV format: RFC 4180 compliant (escape commas, quotes, newlines in values)
  - JSON format: array of objects, pretty-printed
  - JSON columns preserved as-is (not double-escaped)
  - Uses Electron `dialog.showSaveDialog()` for path selection
  - Default filename: `{tableName}_{timestamp}.{csv|json}`

### Data Import
- [ ] Create `src/main/db/data-import.ts`:
  - `previewImport(db, table, filePath, format)`:
    - Parse first 100 rows from file
    - Compare column names to table schema via `pragma table_info`
    - Return `{ columns: { name, matched, targetType }[], previewRows[], totalRows, warnings[] }`
    - Warnings for: unmatched columns, type mismatches, missing required columns
  - `executeImport(db, table, filePath, format, columnMapping?)`:
    - Parse entire file
    - Apply column mapping (source → target column name)
    - Wrap in transaction: INSERT all rows, ROLLBACK on any error
    - Return `{ importedCount, skippedCount, errors: { row, error }[] }`

### IPC
- [ ] Add 4 channels + Zod schemas + handlers:
  - `ext-db-viewer:export-table` — `{ table, format: 'csv'|'json', limit?: number }`
  - `ext-db-viewer:import-select` — `{ format: 'csv'|'json' }` → opens file picker, returns `{ filePath }`
  - `ext-db-viewer:import-preview` — `{ table, filePath, format }` → returns preview data
  - `ext-db-viewer:import-execute` — `{ table, filePath, format, columnMapping? }` → executes import

### Renderer Components
- [ ] Create `ImportExport/ExportDialog.tsx`:
  - Format picker: CSV or JSON radio buttons
  - Optional row limit input (default: all rows)
  - "Export" button → triggers download, shows success toast with file path
- [ ] Create `ImportExport/ImportDialog.tsx`:
  - "Select File" button → opens file picker via `import-select` channel
  - Auto-detects format from file extension
  - Shows ImportPreview after file selected
- [ ] Create `ImportExport/ImportPreview.tsx`:
  - Column mapping table: source column ↔ target column (dropdown)
  - Matched columns highlighted green, unmatched amber
  - Preview of first 10 rows in a mini table
  - Warning badges for type mismatches or missing required columns
  - "Import" button → executes import, shows results (imported/skipped/errors)
- [ ] Add Export and Import buttons to `DataToolbar.tsx`

### Tests
- [ ] `data-export.test.ts`:
  - CSV escaping (commas, quotes, newlines, Unicode)
  - JSON format (proper structure, JSON column handling)
  - Row limits
  - Empty table export
- [ ] `data-import.test.ts`:
  - Column matching (exact match, case mismatch, extra columns, missing columns)
  - Type validation warnings
  - Transaction rollback on error (verify no rows inserted on failure)
  - Large file handling (streaming parse)

## IPC Schemas

```typescript
'ext-db-viewer:export-table': z.object({
  table: z.string().min(1),
  format: z.enum(['csv', 'json']),
  limit: z.number().int().min(1).optional()
})

'ext-db-viewer:import-select': z.object({
  format: z.enum(['csv', 'json'])
})

'ext-db-viewer:import-preview': z.object({
  table: z.string().min(1),
  filePath: z.string().min(1),
  format: z.enum(['csv', 'json'])
})

'ext-db-viewer:import-execute': z.object({
  table: z.string().min(1),
  filePath: z.string().min(1),
  format: z.enum(['csv', 'json']),
  columnMapping: z.record(z.string(), z.string()).optional()
})
```

## Success Criteria

- [ ] Export to CSV produces RFC 4180 compliant output
- [ ] Export to JSON produces valid, pretty-printed JSON array
- [ ] Import preview shows column matching with warnings for mismatches
- [ ] Import executes in a transaction — all-or-nothing on error
- [ ] Import results show count of imported, skipped, and errored rows
- [ ] JSON columns exported/imported without double-escaping
