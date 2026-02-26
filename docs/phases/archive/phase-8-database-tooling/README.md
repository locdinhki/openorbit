# Phase 8: Database Tooling

**Theme:** Built-in database viewer and editor. Inspect and manage all app data without leaving OpenOrbit.

**Effort:** Moderate | **Depends on:** Phase 5 (extension architecture) | **Status:** Not started

## Why This Phase

OpenOrbit stores all state in a single SQLite database — user profile, settings, jobs, schedules, memory facts, and more. Currently there's no way to inspect or edit this data without external tools like DB Browser for SQLite. A built-in `ext-db-viewer` extension gives users visibility into their data and gives developers a debugging tool without leaving the app.

The extension follows the same architecture as `ext-jobs`: manifest-based discovery, scoped IPC with Zod validation, preloaded modules pattern, and view registration. It needs no migrations — it introspects and operates on existing tables.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 8.1 | [Extension Scaffold + Schema Browser](8.1-extension-scaffold/) | Moderate | Extension wiring, sidebar schema browser with table/column/index introspection |
| 8.2 | [Table Data Viewer](8.2-table-data-viewer/) | Moderate | Paginated, sortable, filterable data grid in the workspace |
| 8.3 | [Record Editor](8.3-record-editor/) | Moderate | Inline editing, record creation, deletion with confirmation |
| 8.4 | [Developer Mode + SQL Console](8.4-developer-mode-sql-console/) | Moderate | Dev mode toggle gating raw SQL console and destructive operations |
| 8.5 | [Data Export/Import](8.5-data-export-import/) | Moderate | CSV/JSON export and import with preview and validation |

## Architecture Overview

```
ext-db-viewer (new extension)
├── Main Process
│     ├── schema-introspector.ts  (sqlite_master, pragma table_info/index_list)
│     ├── query-executor.ts       (parameterized SELECT/INSERT/UPDATE/DELETE)
│     ├── data-export.ts          (CSV/JSON export)
│     └── data-import.ts          (CSV/JSON import with validation)
│
├── 13 IPC Channels (ext-db-viewer:*)
│     ├── Schema: schema-tables, schema-columns, schema-indexes
│     ├── Data: table-data
│     ├── CRUD: record-update, record-insert, record-delete (dev-mode)
│     ├── SQL: sql-execute (dev-mode), dev-mode
│     └── I/O: export-table, import-select, import-preview, import-execute
│
└── Renderer
      ├── DbViewerSidebar     (schema browser)
      ├── DbViewerWorkspace   (data grid)
      └── SqlConsolePanel     (raw SQL, dev-mode gated)
```

## Audience

Available to all users with developer-only features behind a toggle:

| Feature | All Users | Dev Mode |
|---------|-----------|----------|
| Schema browser | Yes | Yes |
| Table data viewer | Yes | Yes |
| Record edit/insert | Yes | Yes |
| Record delete | No | Yes |
| Raw SQL console | No | Yes |
| Data export | Yes | Yes |
| Data import | Yes | Yes |

## Key Safety Patterns

- **SQL injection prevention**: Table/column names validated against `sqlite_master` + `pragma table_info` before interpolation; all values use parameterized `?` bindings
- **Destructive ops gated**: DELETE and raw SQL require developer mode enabled
- **Transaction safety**: Imports wrapped in transactions with rollback on error
- **Virtual tables**: FTS5 tables (e.g., `memory_facts_fts`) marked read-only in UI

## Success Criteria

- [ ] Sidebar shows all database tables with row counts and schema details
- [ ] Clicking a table opens paginated, sortable, filterable data in the workspace
- [ ] Records can be edited inline and new records can be inserted
- [ ] Developer mode enables raw SQL console and destructive operations
- [ ] Tables can be exported to CSV/JSON and data imported from files
- [ ] All table/column names validated before SQL construction (no injection)
