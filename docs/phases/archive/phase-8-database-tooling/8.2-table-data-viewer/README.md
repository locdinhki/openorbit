# 8.2: Table Data Viewer

**Effort:** Moderate | **Status:** Not started

## Background

With the schema browser showing table structure, the next step is displaying actual data. Clicking a table in the sidebar opens a paginated, sortable, filterable data grid in the workspace area — the primary interface for inspecting database contents.

## How It Works

```
Renderer                              Main Process
    |                                     |
    |-- DataToolbar (filters, refresh)    |
    |-- DataTable (sortable columns)      |
    |       |                             |
    |       |--invoke ext-db-viewer:table-data -->  query-executor.ts
    |       |   { table, page, pageSize,  |         |-- validate table/column names
    |       |     sortColumn, sortDir,    |         |-- build parameterized SELECT
    |       |     filters[] }             |         |-- pagination via LIMIT/OFFSET
    |       |                             |         |-- return { rows, totalCount }
    |       |<-- { rows[], totalCount } --|
    |       |
    |-- PaginationBar (page nav)
    |-- CellRenderer (JSON expand, NULL style)
```

## Tasks

### Query Executor
- [ ] Create `src/main/db/query-executor.ts`:
  - `queryTableData(db, { table, page, pageSize, sortColumn, sortDirection, filters })` → `{ rows, totalCount }`
  - Validate table name against `sqlite_master` (reject if not found)
  - Validate sort/filter column names against `pragma table_info`
  - Build `SELECT * FROM "table"` with parameterized `WHERE` clauses
  - Support filter operators: `eq`, `neq`, `like`, `gt`, `lt`, `gte`, `lte`, `is-null`, `not-null`
  - Pagination: `LIMIT ? OFFSET ?` (default: 50 rows, page 1)
  - Sorting: `ORDER BY "column" ASC|DESC`
  - Count query: `SELECT COUNT(*) FROM "table" WHERE ...` for total

### IPC
- [ ] Add `ext-db-viewer:table-data` channel + Zod schema + handler

### Renderer Components
- [ ] Create `DbViewerWorkspace.tsx` — workspace view, renders DataTable for selected table
- [ ] Create `DataViewer/DataTable.tsx`:
  - Renders rows in a table with striped rows
  - Column headers clickable to toggle sort (none → ASC → DESC → none)
  - Sort indicator arrow on active column
- [ ] Create `DataViewer/CellRenderer.tsx`:
  - Detects JSON strings via `JSON.parse` attempt → shows formatted preview (first 100 chars) with expand button
  - `NULL` values → styled with distinct muted appearance
  - Long text → truncated with tooltip on hover
  - Booleans (0/1 in INTEGER columns) → displayed as readable values
- [ ] Create `DataViewer/DataToolbar.tsx`:
  - Filter builder: add/remove filter rows (column dropdown + operator dropdown + value input)
  - Refresh button
  - Row count display ("Showing 1-50 of 1,234")
- [ ] Create `DataViewer/PaginationBar.tsx`:
  - First / Previous / Current page / Next / Last buttons
  - Page size selector (25, 50, 100, 200)
  - Total page count

### State & Hooks
- [ ] Create `hooks/useTableData.ts` — fetches data when table/page/sort/filters change, debounced filter input
- [ ] Add `tableDataSlice` to store: `rows`, `totalCount`, `page`, `pageSize`, `sortColumn`, `sortDirection`, `filters`, `loading`

### Tests
- [ ] `query-executor.test.ts`:
  - Pagination math (offset calculation, total pages)
  - Sorting (ASC/DESC, multiple column types)
  - Filtering (each operator, combined filters)
  - SQL injection prevention (reject invalid table/column names)
  - Empty table handling

## IPC Schema

```typescript
'ext-db-viewer:table-data': z.object({
  table: z.string().min(1),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(50),
  sortColumn: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  filters: z.array(z.object({
    column: z.string(),
    operator: z.enum(['eq', 'neq', 'like', 'gt', 'lt', 'gte', 'lte', 'is-null', 'not-null']),
    value: z.string().optional()
  })).optional()
})
```

## Success Criteria

- [ ] Clicking a table in the sidebar shows its data in the workspace
- [ ] Pagination works: navigate pages, change page size
- [ ] Sorting works: click column header to sort ASC/DESC
- [ ] Filtering works: add column filters, data updates
- [ ] JSON columns display formatted with expand toggle
- [ ] NULL values visually distinct
- [ ] No SQL injection possible via table/column/filter values
