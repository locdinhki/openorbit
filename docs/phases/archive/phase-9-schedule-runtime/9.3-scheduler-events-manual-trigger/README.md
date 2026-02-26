# 9.3: Scheduler Events + Manual Trigger + Running Indicator

**Effort:** High | **Status:** Complete

## Background

Users have no way to manually trigger a schedule or see that one is currently running. This subphase adds event callbacks to the Scheduler, a "Run Now" IPC flow, push events for live UI updates, and a pulse-glow running indicator on schedule cards.

## Tasks

### 3A. Add Event Callbacks to Scheduler

- [x] Edit `packages/core/src/automation/scheduler.ts`:
  - Add `SchedulerEvents` interface:
    - `onRunStart?(scheduleId: string): void`
    - `onRunComplete?(scheduleId: string, result: { status: string; error?: string; durationMs: number }): void`
  - Constructor accepts optional `SchedulerEvents`
  - `executeTask()` emits `onRunStart` at start, `onRunComplete` in try/catch
  - Track `durationMs` using `Date.now()` delta
  - Add `triggerNow(scheduleId)` — validates schedule exists, checks overlap, calls `executeTask()`

### 3B. Add IPC Channels

- [x] Edit `packages/core/src/ipc-channels.ts` — add 4 channels:

```typescript
SCHEDULE_TRIGGER:      'schedule:trigger'
SCHEDULE_RUN_START:    'schedule:run-start'     // push
SCHEDULE_RUN_COMPLETE: 'schedule:run-complete'   // push
SCHEDULE_RUNS:         'schedule:runs'
```

- [x] Edit `packages/core/src/ipc-schemas.ts` — add Zod schemas for the 4 channels
- [x] Edit `packages/core/src/__tests__/ipc-channels.test.ts` — update expected count (32 → 36)

### 3C. Wire Scheduler Events to IPC Push

- [x] Edit `src/main/index.ts` — pass event callbacks when constructing Scheduler:

```typescript
cronScheduler = new Scheduler({
  onRunStart: (scheduleId) => {
    mainWindow?.webContents.send(IPC.SCHEDULE_RUN_START, { scheduleId })
  },
  onRunComplete: (scheduleId, result) => {
    mainWindow?.webContents.send(IPC.SCHEDULE_RUN_COMPLETE, { scheduleId, ...result })
  }
})
```

### 3D. Add Trigger + Runs IPC Handlers

- [x] Edit `src/main/ipc-handlers.ts`:
  - `schedule:trigger` → `scheduler.triggerNow(id)`
  - `schedule:runs` → `scheduler.listRuns(scheduleId, limit, offset)`

### 3E. Add to Renderer IPC Client

- [x] Edit `src/renderer/src/lib/ipc-client.ts` — add to schedules namespace:
  - `trigger(id)` — invoke
  - `runs(scheduleId, limit?, offset?)` — invoke
  - `onRunStart(callback)` — push listener, returns cleanup
  - `onRunComplete(callback)` — push listener, returns cleanup

### 3F. Add Executing State to Shell Store

- [x] Edit `src/renderer/src/store/shell-store.ts`:
  - Add `executingScheduleIds: Set<string>` state
  - Add `markScheduleExecuting(id)` and `markScheduleIdle(id)` actions

### 3G. Wire Push Events + Trigger in useSchedules Hook

- [x] Edit `src/renderer/src/lib/use-schedules.ts`:
  - `useEffect` subscribes to `onRunStart` / `onRunComplete` push events
  - `onRunStart` → `markScheduleExecuting(data.scheduleId)`
  - `onRunComplete` → `markScheduleIdle(data.scheduleId)` + `load()` to refresh
  - Add `triggerSchedule(id)` callback
  - Expose `executingScheduleIds` and `triggerSchedule`

### 3H. Update AutomationsPanel + ScheduleCard UI

- [x] Edit `src/renderer/src/components/Shell/views/AutomationsPanel.tsx`:
  - Pass `isExecuting` and `onTrigger` to ScheduleCard
  - ScheduleCard: add play button ("Run Now")
  - ScheduleCard: `animate-pulse-glow` border when executing
  - ScheduleCard: "Running" badge when executing

## Files

| File | Action |
|------|--------|
| `packages/core/src/automation/scheduler.ts` | EDIT — events, triggerNow, duration |
| `packages/core/src/ipc-channels.ts` | EDIT — 4 new channels |
| `packages/core/src/ipc-schemas.ts` | EDIT — 4 new schemas |
| `packages/core/src/__tests__/ipc-channels.test.ts` | EDIT — channel count |
| `src/main/index.ts` | EDIT — pass SchedulerEvents |
| `src/main/ipc-handlers.ts` | EDIT — trigger + runs handlers |
| `src/renderer/src/lib/ipc-client.ts` | EDIT — trigger, runs, push listeners |
| `src/renderer/src/store/shell-store.ts` | EDIT — executingScheduleIds |
| `src/renderer/src/lib/use-schedules.ts` | EDIT — push listeners, triggerSchedule |
| `src/renderer/src/components/Shell/views/AutomationsPanel.tsx` | EDIT — Run Now, pulse-glow |

## Success Criteria

- [x] `scheduler.triggerNow(id)` executes the handler immediately
- [x] `triggerNow` throws when schedule not found or already executing
- [x] `onRunStart` and `onRunComplete` callbacks fire at correct times
- [x] IPC push events reach renderer when schedules start/complete
- [x] "Run Now" button on schedule card triggers extraction via IPC
- [x] Card shows `animate-pulse-glow` + "Running" badge while executing
- [x] Badge and glow clear when run completes
