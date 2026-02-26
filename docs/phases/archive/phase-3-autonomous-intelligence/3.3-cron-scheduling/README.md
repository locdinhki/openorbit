# 3.3: Cron Scheduling (COMPLETE ✓)

**Effort:** Low-Moderate | **Status:** Complete

## Background

From [OpenClaw Analysis Section 4D](../../research/openclaw-analysis.md): "Search LinkedIn every morning at 8am" without manual clicking. Periodic tasks should run autonomously.

## Tasks

### Scheduler Service
- [x] Install `node-cron`
- [x] Create `src/main/scheduler/scheduler.ts`:
  - Store schedules in SQLite `schedules` table:
    - `id`, `name`, `cron_expression`, `profile_id`, `task_type`, `enabled`
    - `last_run`, `next_run`, `last_status`
  - Evaluate cron expressions using node-cron
  - On trigger: invoke same flow as `AUTOMATION_START` IPC handler
  - Handle overlapping runs (skip if previous still running)

### Schedulable Task Types
- [x] Job extraction (primary use case)
- [x] Hint file verification (check selectors still work)
- [x] Database backup
- [x] Log rotation
- [x] Daily summary generation (via Claude)

### IPC Channels
- [x] Add to `src/shared/ipc-channels.ts`:
  - `SCHEDULE_LIST`, `SCHEDULE_CREATE`, `SCHEDULE_UPDATE`, `SCHEDULE_DELETE`, `SCHEDULE_TOGGLE`
- [x] Add handlers in `ipc-handlers.ts`

### Schedule UI
- [x] Create `src/renderer/src/components/Settings/Schedules.tsx`:
  - Schedule list with enable/disable toggle
  - Cron builder (presets: daily, weekdays, weekly, custom)
  - Show last run time, next run time, last status
  - Create/edit/delete schedules

### App Integration
- [x] Initialize scheduler on app ready in `src/main/index.ts`
- [x] Ensure schedules run even when app is minimized to tray

## Files to Create

```
src/main/scheduler/scheduler.ts
src/renderer/src/components/Settings/Schedules.tsx
```

## Files to Modify

```
package.json (node-cron)
src/shared/ipc-channels.ts (schedule channels)
src/main/ipc-handlers.ts (schedule handlers)
src/main/db/database.ts (schedules migration)
src/main/index.ts (initialize scheduler)
```

## Success Criteria

- [x] "Search LinkedIn every weekday at 8am" works
- [x] Scheduled runs produce same results as manual runs
- [x] Schedule history visible in UI
- [x] Overlapping runs prevented
