# 8.1: Extension Scaffold + Schema Browser

**Effort:** Moderate | **Status:** Not started

## Background

The `ext-db-viewer` extension needs the same scaffolding as every OpenOrbit extension: manifest, main-process entry, renderer entry, IPC channels with Zod schemas, and shell integration (preloaded modules, vite aliases). The first feature is a schema browser — a sidebar that lists all database tables with their columns, types, and indexes.

## How It Works

```
Main Process
    |
    |-- schema-introspector.ts
    |       |-- sqlite_master → list tables + types (table/view/virtual)
    |       |-- pragma table_info(t) → columns, types, defaults, PK
    |       |-- pragma index_list(t) → indexes
    |       |-- SELECT COUNT(*) → row counts
    |
    |-- 3 IPC handlers
            ext-db-viewer:schema-tables
            ext-db-viewer:schema-columns
            ext-db-viewer:schema-indexes

Renderer
    |
    |-- DbViewerSidebar
            |-- TableList (tables grouped by type: regular, system, virtual)
            |-- TableDetail (columns, types, constraints, indexes)
```

## Tasks

### Extension Scaffold
- [ ] Create `packages/extensions/ext-db-viewer/package.json` with `openorbit` manifest
  - `id: ext-db-viewer`, `displayName: Database Viewer`, `icon: database`
  - `activationEvents: ["onStartup"]`
  - `contributes`: sidebar (`db-viewer-sidebar`), workspace (`db-viewer-workspace`), panel (`db-viewer-sql`)
- [ ] Create `src/ipc-channels.ts` — 3 channel constants
- [ ] Create `src/ipc-schemas.ts` — Zod schemas for each channel
- [ ] Create `src/main/index.ts` — `ExtensionMainAPI` with `activate`/`deactivate` (no migrations)
- [ ] Create `src/main/ipc-handlers.ts` — register 3 schema handlers

### Shell Integration
- [ ] `src/main/index.ts` — add static import + `['ext-db-viewer', extDbViewerMain]` to preloadedModules
- [ ] `src/renderer/src/App.tsx` — add static import + `['ext-db-viewer', extDbViewerRenderer]` to rendererModules
- [ ] `electron.vite.config.ts` — add `@openorbit/ext-db-viewer` alias in main + renderer sections

### Schema Introspection
- [ ] Create `src/main/db/schema-introspector.ts`:
  - `listTables(db)` → `{ name, type, rowCount }[]` via `sqlite_master` + `COUNT(*)`
  - `getColumns(db, table)` → `{ name, type, notnull, defaultValue, isPrimaryKey }[]` via `pragma table_info`
  - `getIndexes(db, table)` → `{ name, unique, columns }[]` via `pragma index_list` + `pragma index_info`
  - Validate table names against `sqlite_master` before any query (SQL injection prevention)

### Renderer
- [ ] Create `src/renderer/index.ts` — register sidebar, workspace, panel views
- [ ] Create `src/renderer/lib/ipc-client.ts` — typed IPC wrapper for schema channels
- [ ] Create `DbViewerSidebar.tsx` — table list with row counts, click to select
- [ ] Create `Schema/TableList.tsx` — scrollable list grouped by type:
  - Regular tables (default)
  - System tables (`_migrations`, `_ext_migrations`) — lock icon
  - Virtual tables (FTS5) — read-only badge
- [ ] Create `Schema/TableDetail.tsx` — columns, types, constraints, indexes for selected table
- [ ] Create `hooks/useSchema.ts` — fetches table list on mount, columns on table select

### Tests
- [ ] `schema-introspector.test.ts` — table listing, column info, index info, handles empty DB, rejects invalid table names
- [ ] `ipc-channels.test.ts` — all channels match `/^[a-z-]+:[a-z-]+$/`

## Files to Create

```
packages/extensions/ext-db-viewer/
├── package.json
├── src/
│   ├── ipc-channels.ts
│   ├── ipc-schemas.ts
│   ├── main/
│   │   ├── index.ts
│   │   ├── ipc-handlers.ts
│   │   └── db/
│   │       └── schema-introspector.ts
│   └── renderer/
│       ├── index.ts
│       ├── lib/ipc-client.ts
│       ├── hooks/useSchema.ts
│       └── components/
│           ├── DbViewerSidebar.tsx
│           └── Schema/
│               ├── TableList.tsx
│               └── TableDetail.tsx
```

## Files to Modify

- `src/main/index.ts` — preloaded module import
- `src/renderer/src/App.tsx` — renderer module import
- `electron.vite.config.ts` — path alias

## Success Criteria

- [ ] Extension discovered and activated on startup (visible in extension host logs)
- [ ] Sidebar shows "Database" entry with database icon
- [ ] Clicking sidebar lists all tables with row counts
- [ ] Selecting a table shows columns, types, PK markers, and indexes
- [ ] System tables and virtual tables visually distinguished
- [ ] All IPC channels pass naming convention test
