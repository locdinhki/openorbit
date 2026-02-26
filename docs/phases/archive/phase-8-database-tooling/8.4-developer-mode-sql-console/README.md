# 8.4: Developer Mode + SQL Console

**Effort:** Moderate | **Status:** Not started

## Background

A raw SQL console is invaluable for debugging and development but dangerous for regular use. Developer mode is a persistent toggle that gates destructive features: the SQL console, record deletion, and future power-user features. The toggle is stored in the existing `settings` table.

## How It Works

```
Settings table
    key: 'ext-db-viewer:dev-mode'
    value: 'true' | 'false' (default: 'false')

Developer Mode OFF                    Developer Mode ON
├── Schema browser ✓                  ├── Schema browser ✓
├── Data viewer ✓                     ├── Data viewer ✓
├── Record insert ✓                   ├── Record insert ✓
├── Record edit ✓                     ├── Record edit ✓
├── Record delete ✗                   ├── Record delete ✓
├── SQL console ✗                     ├── SQL console ✓
├── Data export ✓                     ├── Data export ✓
└── Data import ✓                     └── Data import ✓
```

## Tasks

### Developer Mode Setting
- [ ] Store in `settings` table: key `ext-db-viewer:dev-mode`, value `true`/`false`
- [ ] Add `ext-db-viewer:dev-mode` IPC channel:
  - `{ action: 'get' }` → returns `{ enabled: boolean }`
  - `{ action: 'set', enabled: true/false }` → updates setting, returns new state
- [ ] Default to `false` when key doesn't exist

### SQL Console
- [ ] Add `ext-db-viewer:sql-execute` IPC channel + handler:
  - Reject if dev mode is off
  - Parse SQL to detect statement type (SELECT vs mutating)
  - For SELECT: auto-append `LIMIT 1000` if no LIMIT clause present
  - For mutating statements (INSERT/UPDATE/DELETE/CREATE/DROP/ALTER): execute via `db.prepare(sql).run()`
  - Return `{ columns, rows, rowsAffected, executionTimeMs, statementType }`
  - Catch SQL errors → return structured error response (not a crash)

### Renderer Components
- [ ] Create `SqlConsole/SqlEditor.tsx`:
  - Multi-line textarea for SQL input
  - Basic keyword highlighting (SELECT, FROM, WHERE, etc.) via regex in `<pre>` overlay
  - Cmd+Enter (Mac) / Ctrl+Enter to execute
  - Tab inserts spaces
- [ ] Create `SqlConsole/ResultsTable.tsx`:
  - For SELECT: render columns + rows in a table
  - For mutations: show "N rows affected" message
  - Show execution time
  - Show error message with SQL error details on failure
- [ ] Create `SqlConsole/QueryHistory.tsx`:
  - Last 50 queries stored in memory (not persisted across sessions)
  - Click a query to reload into editor
  - Shows timestamp and statement type
- [ ] Create `SqlConsolePanel.tsx`:
  - Registered as panel view `db-viewer-sql`
  - When dev mode off: shows "Enable Developer Mode to use the SQL console" with a button to enable
  - When dev mode on: shows SqlEditor + ResultsTable + QueryHistory

### Dev Mode UI
- [ ] Toggle in sidebar header area (small toggle switch or icon button)
- [ ] When enabled: "DEV" badge visible in sidebar header
- [ ] When enabled: delete buttons appear in DataTable rows (red styling)
- [ ] When disabled: delete buttons hidden, SQL console shows enablement prompt

### State & Hooks
- [ ] Create `hooks/useDevMode.ts` — get/set dev mode state
- [ ] Create `hooks/useSqlConsole.ts` — execute query, manage history
- [ ] Add `sqlConsoleSlice` to store: `currentSql`, `results`, `queryHistory`, `isExecuting`, `executionTime`, `error`
- [ ] Add `settingsSlice` to store: `devModeEnabled`

### Tests
- [ ] Dev mode gating: `sql-execute` rejects when dev mode off
- [ ] LIMIT safeguard: unbounded SELECT gets LIMIT 1000 appended
- [ ] SQL error handling: syntax errors return structured response
- [ ] Statement type detection: SELECT, INSERT, UPDATE, DELETE, CREATE, DROP

## IPC Schemas

```typescript
'ext-db-viewer:dev-mode': z.object({
  action: z.enum(['get', 'set']),
  enabled: z.boolean().optional()
})

'ext-db-viewer:sql-execute': z.object({
  sql: z.string().min(1).max(10000),
  params: z.array(z.unknown()).optional()
})
```

## Success Criteria

- [ ] Dev mode toggle persists across sessions (stored in settings table)
- [ ] SQL console executes SELECT queries and shows results in a table
- [ ] SQL console executes mutations and shows rows affected
- [ ] Unbounded SELECTs auto-limited to 1000 rows
- [ ] SQL errors displayed as structured messages (not crashes)
- [ ] `sql-execute` rejects when dev mode is off
- [ ] Delete buttons only visible when dev mode is on
- [ ] "DEV" badge visible in sidebar when dev mode is enabled
