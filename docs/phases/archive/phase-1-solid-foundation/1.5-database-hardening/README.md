# 1.5: Database Hardening

**Effort:** Low | **Status:** Complete

## Goal

Add transaction wrappers, automated backups, and schema validation on startup to prevent data corruption and ensure recoverability.

## Tasks

### Transaction Wrappers
- [x] Create `src/main/db/transaction.ts`
  - Export `withTransaction(db, fn)` helper wrapping `db.transaction()`
  - Returns the function result or throws with rollback
- [x] Apply to `ExtractionRunner.extractFromProfile()` where multiple inserts happen in loops
- [x] Apply to any future multi-step write operations

### Backup System
- [x] Create `src/main/db/backup.ts`
  - Use better-sqlite3's `backup()` API to create `.db.bak` files
  - Backup location: `{userData}/backups/`
  - Run before migrations
  - Run on configurable interval (default: daily)
  - Keep last N backups (configurable, default 5)
  - Prune old backups on startup

### Schema Validation on Startup
- [x] Add to `src/main/db/database.ts` post-migration:
  - Verify expected tables exist (all 7 + `_migrations`)
  - Verify expected columns on each table
  - Log warnings for any schema drift
  - Do NOT fail on drift (just warn) — allows forward compatibility

## Files to Create

```
src/main/db/transaction.ts
src/main/db/backup.ts
```

## Files to Modify

```
src/main/db/database.ts (add backup calls, schema check after migration)
src/main/automation/extraction-runner.ts (wrap multi-inserts in transaction)
```

## Success Criteria

- [x] Database backup exists before every migration run
- [x] Concurrent writes from extraction + UI do not cause `SQLITE_BUSY`
- [x] Startup logs confirm schema integrity
- [x] Old backups are automatically pruned
