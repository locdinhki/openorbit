# 9.4: Run History

**Effort:** Moderate | **Status:** Complete

## Background

Users have no visibility into past schedule executions — whether they succeeded, failed, or how long they took. This subphase adds a `schedule_runs` table, a repository for recording runs, and a detail modal that shows run history when clicking a schedule card.

## Tasks

### 4A. Database Migration V7

- [x] Edit `packages/core/src/db/database.ts`:
  - Add `MIGRATION_V7_SQL` creating `schedule_runs` table:

```sql
CREATE TABLE IF NOT EXISTS schedule_runs (
  id            TEXT PRIMARY KEY,
  schedule_id   TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK(status IN ('success', 'error', 'running')),
  error_message TEXT,
  duration_ms   INTEGER,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_schedule_runs_schedule ON schedule_runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_runs_started  ON schedule_runs(started_at DESC);
```

  - Add to migrations array + `EXPECTED_TABLES`

### 4B. Create ScheduleRunsRepo

- [x] Create `packages/core/src/db/schedule-runs-repo.ts`:
  - `insertStart(scheduleId)` → generates UUID, inserts row with `status='running'`, returns `runId`
  - `complete(runId, { status, errorMessage?, durationMs })` → updates row with status, error, duration, completed_at
  - `listBySchedule(scheduleId, limit, offset)` → returns paginated runs ordered by `started_at DESC`

### 4C. Integrate into Scheduler

- [x] Edit `packages/core/src/automation/scheduler.ts`:
  - Add `ScheduleRunsRepo` instance
  - In `executeTask`: call `runsRepo.insertStart()` before handler, `runsRepo.complete()` in try/catch
  - Add `listRuns(scheduleId, limit?, offset?)` method

### 4D. Create ScheduleDetailModal

- [x] Create `src/renderer/src/components/Shell/views/ScheduleDetailModal.tsx`:
  - Opens when clicking a schedule card
  - Shows schedule info summary (tool, cron expression, status)
  - Run history list:
    - Status badge (success/error/running)
    - `timeAgo` timestamp
    - Duration in human-readable format
    - Error message (truncated with `title` tooltip)
  - Uses `Skeleton` component while loading

### 4E. Wire Detail Modal into AutomationsPanel

- [x] Edit `src/renderer/src/components/Shell/views/AutomationsPanel.tsx`:
  - Add `detailScheduleId` state
  - Make ScheduleCard body clickable (`onClick` → open detail modal)
  - Stop propagation on action buttons (edit, delete, trigger)
  - Render `ScheduleDetailModal` when `detailScheduleId` is set

## Files

| File | Action |
|------|--------|
| `packages/core/src/db/database.ts` | EDIT — migration v7 |
| `packages/core/src/db/schedule-runs-repo.ts` | CREATE |
| `packages/core/src/automation/scheduler.ts` | EDIT — runsRepo integration, listRuns |
| `src/renderer/src/components/Shell/views/ScheduleDetailModal.tsx` | CREATE |
| `src/renderer/src/components/Shell/views/AutomationsPanel.tsx` | EDIT — detail modal wiring |

## Success Criteria

- [x] `schedule_runs` table created by migration v7
- [x] Runs are recorded automatically when schedules execute
- [x] Clicking a schedule card opens detail modal
- [x] Detail modal shows schedule summary and paginated run history
- [x] Run history entries display status badge, timeAgo, duration, and error messages
- [x] Skeleton shimmer shown while run history loads
- [x] Deleting a schedule cascades to delete its run history
