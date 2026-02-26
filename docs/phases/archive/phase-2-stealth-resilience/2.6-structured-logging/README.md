# 2.6: Structured Logging

**Effort:** Low | **Status:** Complete

## Goal

Persist logs to files for debugging and add session metrics for tracking automation performance.

## Tasks

### File-Based Log Persistence
- [x] Enhance `src/main/utils/logger.ts`:
  - Write logs to `{userData}/logs/` directory
  - NDJSON format (one JSON object per line, machine-parseable)
  - Rotating files: 10MB max per file
  - 7-day retention, auto-prune old logs
  - Include: timestamp, level, module, message, metadata

### Performance Instrumentation
- [x] Add timing to key operations:
  - Session initialization time
  - Page extraction time per listing
  - Claude API call response time
  - Database query time for batch operations
- [x] Use `performance.mark()` / `performance.measure()` or simple `Date.now()` diffs
- [x] Log as structured entries with `type: 'perf'`

### Session Metrics
- [x] Add `session_metrics` table (new migration in `database.ts`):
  - `id`, `started_at`, `ended_at`, `duration_seconds`
  - `jobs_extracted`, `jobs_analyzed`, `applications_sent`
  - `errors_count`, `actions_count`, `actions_per_minute`
  - `profile_id`, `platform`
- [x] At session end, write summary to this table
- [x] Expose via IPC for dashboard (Phase 3.5)

## Files to Modify

```
src/main/utils/logger.ts (file persistence, NDJSON format)
src/main/db/database.ts (new migration for session_metrics)
src/main/automation/extraction-runner.ts (session metrics collection)
src/main/ai/claude-service.ts (API call timing)
```

## Success Criteria

- [x] Logs written to `{userData}/logs/` as NDJSON files
- [x] Claude API calls include response time in logs
- [x] Session summary persisted after each automation run
- [x] Old logs auto-pruned after 7 days
