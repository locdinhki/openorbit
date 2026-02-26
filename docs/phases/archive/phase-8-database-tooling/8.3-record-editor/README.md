# 8.3: Record Editor

**Effort:** Moderate | **Status:** Not started

## Background

With the data viewer displaying table contents, users need to edit records — update field values, insert new rows, and delete rows. The editor supports inline cell editing for quick changes and a modal form for full record creation/editing. Delete operations require developer mode (wired in 8.4).

## How It Works

```
DataTable row
    |
    |-- Double-click cell → inline edit (blur/Enter to save)
    |       |
    |       |--invoke ext-db-viewer:record-update --> query-executor.updateRecord()
    |
    |-- "Add Record" button → RecordModal (all columns with type-aware inputs)
    |       |
    |       |--invoke ext-db-viewer:record-insert --> query-executor.insertRecord()
    |
    |-- Delete icon (dev-mode only) → DeleteConfirm dialog
            |
            |--invoke ext-db-viewer:record-delete --> query-executor.deleteRecord()
```

## Tasks

### Query Executor (write methods)
- [ ] Add to `query-executor.ts`:
  - `getPrimaryKey(db, table)` → `{ columns: string[], usesRowid: boolean }` via `pragma table_info` (pk > 0) with `rowid` fallback
  - `updateRecord(db, table, primaryKey, changes)` → `UPDATE "table" SET "col1"=?, "col2"=? WHERE "pk"=?`
  - `insertRecord(db, table, values)` → `INSERT INTO "table" ("cols"...) VALUES (?, ?...)`
  - `deleteRecord(db, table, primaryKey)` → `DELETE FROM "table" WHERE "pk"=?`
  - All methods validate table/column names against schema introspection
  - All values via parameterized `?` bindings

### IPC
- [ ] Add 3 channels + Zod schemas + handlers:
  - `ext-db-viewer:record-update` — `{ table, primaryKey: Record<string, unknown>, changes: Record<string, unknown> }`
  - `ext-db-viewer:record-insert` — `{ table, values: Record<string, unknown> }`
  - `ext-db-viewer:record-delete` — `{ table, primaryKey: Record<string, unknown> }`

### Renderer Components
- [ ] Create `RecordEditor/RecordModal.tsx`:
  - Shows all columns with their types and defaults
  - For insert: pre-fills defaults, allows overriding
  - For edit: pre-fills current values
  - Save button → calls insert or update
  - Cancel button / Escape to close
- [ ] Create `RecordEditor/FieldInput.tsx` — type-aware inputs:
  - `TEXT` → textarea (auto-resize)
  - `TEXT` with JSON → textarea with pretty-print toggle
  - `INTEGER` → number input
  - `REAL` → number input with decimal
  - `BLOB` → hex preview (read-only)
  - Shows column type, nullable status, default value as hints
- [ ] Create `RecordEditor/DeleteConfirm.tsx`:
  - Shows record preview (all columns)
  - "Delete" button with red styling
  - Cancel button
- [ ] Inline editing in `DataTable.tsx`:
  - Double-click cell → input appears in-place
  - Escape to cancel, Enter or blur to submit
  - Shows saving indicator
  - Reverts on error with toast notification

### Read-only Tables
- [ ] FTS5 virtual tables: hide edit/delete/insert buttons
- [ ] System tables (`_migrations`, `_ext_migrations`): show warning before edits

### Tests
- [ ] `query-executor.test.ts` additions:
  - PK detection (single column, multi-column, rowid fallback)
  - Insert with all column types
  - Update specific columns by PK
  - Delete by PK
  - Reject operations on invalid table names

## Success Criteria

- [ ] Double-click a cell to edit inline, changes saved on blur/Enter
- [ ] "Add Record" opens modal with type-aware inputs for all columns
- [ ] Delete shows confirmation dialog with record preview
- [ ] Virtual tables (FTS5) are read-only — no edit/delete/insert buttons
- [ ] All write operations use parameterized queries
