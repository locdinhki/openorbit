# 2.3: Rate Limiter + Circuit Breaker

**Effort:** Low | **Status:** Complete

## Background

`src/main/utils/rate-limiter.ts` is a 2-line stub. The constants exist in `constants.ts` (MAX_ACTIONS_PER_MINUTE=8, MAX_APPLICATIONS_PER_SESSION=15, etc.) but nothing enforces them systematically.

## Tasks

### Rate Limiter
- [x] Implement `src/main/utils/rate-limiter.ts`:
  - Sliding window algorithm
  - Track: actions/minute, applications/session, extractions/session, session duration
  - API: `canPerformAction(type)`, `recordAction(type)`, `getRemainingQuota()`
  - Configurable limits from `AutonomySettings`
  - Persist rate limit state to SQLite for cross-restart tracking within a session

### Circuit Breaker
- [x] Create `src/main/utils/circuit-breaker.ts`:
  - Track consecutive failures per platform
  - States: `closed` (normal), `open` (tripped), `half-open` (testing)
  - After N consecutive failures (configurable, default 5): trip to `open`
  - When `open`: stop automation, log, notify UI via IPC
  - After cooldown (configurable, default 5 minutes): transition to `half-open`
  - In `half-open`: allow one action; if success → `closed`, if fail → `open`

### Integration
- [x] `ExtractionRunner` calls `rateLimiter.canPerformAction()` before each extraction
- [x] `ActionEngine` calls it before each action
- [x] On limit hit: pause automation, emit `AUTOMATION_STATUS` with `reason: 'rate_limited'`
- [x] On circuit break: emit `AUTOMATION_STATUS` with `reason: 'circuit_breaker_tripped'`

## Files to Create/Modify

```
src/main/utils/rate-limiter.ts (implement from stub)
src/main/utils/circuit-breaker.ts (new)
src/main/automation/extraction-runner.ts (integrate)
src/main/automation/action-engine.ts (integrate)
```

## Success Criteria

- [x] Automation pauses when rate limits hit
- [x] 5 consecutive LinkedIn failures trip the circuit breaker
- [x] Rate limit state persists across app restarts within 24h
- [x] Circuit breaker auto-recovers after cooldown
