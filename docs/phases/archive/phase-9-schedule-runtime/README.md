# Phase 9: Schedule Runtime, Run History & Animation System

**Theme:** Runtime feedback for schedules — manual triggers, live running indicators, run history, browser cleanup, and a lightweight animation system.

**Effort:** Moderate | **Depends on:** Phase 8 (schedule wizard & CRUD) | **Status:** Complete

## Why This Phase

The schedule wizard and CRUD are complete (Phase 8). But schedules lack runtime feedback — users can't tell when a schedule is running, can't trigger one manually, can't see past runs, and the browser stays open after extraction finishes. The UI also has no animation system (modals appear instantly, no loading skeletons, no visual cues for state changes).

This phase adds:

- **Browser cleanup** after extraction (`ext-jobs` closes the session when done)
- **Manual "Run Now"** trigger button
- **Live running indicator** on schedule cards (pulse-glow animation)
- **Run history** table + detail modal
- **Lightweight CSS animation system** (fade-in, slide-up, shimmer, pulse-glow)

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 9.1 | [Animation System](9.1-animation-system/) | Low | CSS keyframes, utility classes, modal animations, Skeleton component |
| 9.2 | [Browser Cleanup](9.2-browser-cleanup/) | Low | Close browser session after extraction completes |
| 9.3 | [Scheduler Events + Manual Trigger](9.3-scheduler-events-manual-trigger/) | High | Event callbacks, IPC channels, "Run Now" button, live running indicator |
| 9.4 | [Run History](9.4-run-history/) | Moderate | Database migration, ScheduleRunsRepo, detail modal with run history list |
| 9.5 | [Tests](9.5-tests/) | Low | Scheduler tests for trigger, events, duration tracking, run history |

## Architecture Overview

```
Scheduler (core)
├── SchedulerEvents           (onRunStart, onRunComplete callbacks)
├── triggerNow(scheduleId)    (manual trigger with overlap check)
├── ScheduleRunsRepo          (schedule_runs table CRUD)
└── listRuns(scheduleId)      (paginated run history)

IPC Push Events
├── schedule:run-start    →   renderer marks card as executing
└── schedule:run-complete →   renderer clears executing + refreshes

ext-jobs (extraction handler)
└── try/finally             → session.close() after extraction

Renderer
├── Animation System        (keyframes, utility classes, Skeleton)
├── ScheduleCard            (pulse-glow when running, "Run Now" button)
└── ScheduleDetailModal     (run history list with status/duration)
```

## Data Flow

```
User clicks "Run Now"
  → ipc invoke schedule:trigger
  → Scheduler.triggerNow(id)
    → runsRepo.insertStart(scheduleId)
    → onRunStart callback → ipc push schedule:run-start
    → renderer: card shows pulse-glow + "Running" badge
    → handler executes extraction
    → ext-jobs: session.close() in finally block
    → runsRepo.complete(runId, { status, durationMs })
    → onRunComplete callback → ipc push schedule:run-complete
    → renderer: card clears glow, refreshes data

User clicks schedule card
  → ipc invoke schedule:runs
  → ScheduleDetailModal shows run history list
```

## New IPC Channels (4)

| Channel | Direction | Description |
|---------|-----------|-------------|
| `schedule:trigger` | invoke | Manual trigger — calls `scheduler.triggerNow(id)` |
| `schedule:run-start` | push | Emitted when a schedule starts executing |
| `schedule:run-complete` | push | Emitted when a schedule finishes (success or error) |
| `schedule:runs` | invoke | Fetch paginated run history for a schedule |

## New Database Table

```sql
CREATE TABLE schedule_runs (
  id            TEXT PRIMARY KEY,
  schedule_id   TEXT NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK(status IN ('success', 'error', 'running')),
  error_message TEXT,
  duration_ms   INTEGER,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);

CREATE INDEX idx_schedule_runs_schedule ON schedule_runs(schedule_id);
CREATE INDEX idx_schedule_runs_started  ON schedule_runs(started_at DESC);
```

## Files Summary

| File | Action |
|------|--------|
| `src/renderer/src/assets/main.css` | EDIT — keyframes + utility classes |
| `src/renderer/src/components/shared/Modal.tsx` | EDIT — fade-in + slide-up |
| `src/renderer/src/components/shared/Skeleton.tsx` | CREATE |
| `ext-jobs/src/main/index.ts` | EDIT — session.close() after extraction |
| `core/src/automation/scheduler.ts` | EDIT — events, triggerNow, duration, runsRepo |
| `core/src/db/database.ts` | EDIT — migration v7 |
| `core/src/db/schedule-runs-repo.ts` | CREATE |
| `core/src/ipc-channels.ts` | EDIT — 4 new channels |
| `core/src/ipc-schemas.ts` | EDIT — 4 new schemas |
| `core/src/__tests__/ipc-channels.test.ts` | EDIT — channel count |
| `core/src/automation/__tests__/scheduler.test.ts` | EDIT — new tests |
| `src/main/index.ts` | EDIT — pass SchedulerEvents |
| `src/main/ipc-handlers.ts` | EDIT — trigger + runs handlers |
| `src/renderer/src/lib/ipc-client.ts` | EDIT — trigger, runs, push listeners |
| `src/renderer/src/store/shell-store.ts` | EDIT — executingScheduleIds |
| `src/renderer/src/lib/use-schedules.ts` | EDIT — push listeners, triggerSchedule |
| `src/renderer/src/components/Shell/views/AutomationsPanel.tsx` | EDIT — Run Now, pulse-glow, detail modal |
| `src/renderer/src/components/Shell/views/ScheduleDetailModal.tsx` | CREATE |

## Success Criteria

- [x] Modals animate in with fade-in overlay + slide-up dialog
- [x] Skeleton component renders shimmer bars for loading states
- [x] Browser session closes automatically after extraction completes
- [x] "Run Now" button on schedule cards triggers immediate extraction
- [x] Schedule card shows pulse-glow animation + "Running" badge while executing
- [x] Clicking a schedule card opens detail modal with run history
- [x] Run history shows status, duration, timestamps, and error messages
- [x] All new scheduler behavior covered by tests
- [x] `npx vitest run` — all tests pass (722 tests, 61 files)
- [x] `npx electron-vite build` — build succeeds