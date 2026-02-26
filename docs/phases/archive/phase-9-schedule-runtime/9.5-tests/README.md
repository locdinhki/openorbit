# 9.5: Tests

**Effort:** Low | **Status:** Complete

## Background

All new scheduler behavior needs test coverage — manual trigger, event callbacks, duration tracking, and run history recording.

## Tasks

### Scheduler Tests

- [x] Edit `packages/core/src/automation/__tests__/scheduler.test.ts`:

| Test | Description |
|------|-------------|
| `triggerNow()` executes handler immediately | Verify handler is called with correct config |
| `triggerNow()` throws when schedule not found | Pass invalid ID, expect error |
| `triggerNow()` throws when already executing | Trigger twice concurrently, expect overlap error |
| Event callbacks `onRunStart` / `onRunComplete` | Mock callbacks, verify called with correct args |
| `durationMs` is tracked | Verify `onRunComplete` result includes realistic `durationMs` |
| `ScheduleRunsRepo` integration | Mock repo, verify `insertStart` called before handler, `complete` called after |

## Files

| File | Action |
|------|--------|
| `packages/core/src/automation/__tests__/scheduler.test.ts` | EDIT — new tests |

## Success Criteria

- [x] All 6 new test cases pass
- [x] `npx vitest run` — full suite passes (no regressions)
