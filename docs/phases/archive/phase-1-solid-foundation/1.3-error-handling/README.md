# 1.3: Error Handling

**Effort:** Low-Moderate | **Status:** Complete

## Goal

Add structured error types, React Error Boundaries, and proper error propagation so that failures are informative, recoverable, and isolated.

## Tasks

### Structured Error Types
- [x] Create `src/shared/errors.ts`
  - `OpenOrbitError` base class extending `Error`
    - Fields: `code` (string), `context` (object), `recoverable` (boolean)
  - Subclasses:
    - `AuthenticationError` — session expired, login required
    - `PlatformError` — platform-specific failures (captcha, blocked, page changed)
    - `AIServiceError` — Claude API errors (rate limit, timeout, invalid response)
    - `DatabaseError` — SQLite errors (constraint violations, corruption)
    - `AutomationError` — browser automation failures (element not found, navigation timeout)
  - Each maps to a user-facing message and suggested recovery action

### React Error Boundaries
- [x] Create `src/renderer/src/components/shared/ErrorBoundary.tsx`
  - Class component with `componentDidCatch`
  - Fallback UI: "Something went wrong" with error details and "Retry" button
  - Logs error to main process via IPC for persistence
  - Props: `section` (string) for identifying which panel crashed

### Apply Error Boundaries
- [x] Wrap each panel in `src/renderer/src/components/Layout/ThreePanel.tsx`:
  - `<ErrorBoundary section="left">` (sidebar)
  - `<ErrorBoundary section="center">` (main content)
  - `<ErrorBoundary section="right">` (browser panel)
  - One panel crashing does not affect the others

### Refactor Catch Blocks
- [x] Update `src/main/ipc-handlers.ts`:
  - Replace `String(err)` with structured error types preserving stack traces
  - Include error codes in responses
- [x] Update `src/main/automation/extraction-runner.ts`:
  - Use `PlatformError` and `AutomationError` for specific failures
- [x] Update `src/main/ai/claude-service.ts`:
  - Use `AIServiceError` with specific codes for rate limiting, timeout, parse failure

### Error Codes
Machine-readable codes for programmatic handling:

| Code | Meaning |
|------|---------|
| `AUTH_REQUIRED` | Session expired, re-login needed |
| `RATE_LIMITED` | API or platform rate limit hit |
| `HINT_FAILED` | No selector found for action |
| `AI_TIMEOUT` | Claude API timed out |
| `AI_PARSE_ERROR` | Claude returned unparseable response |
| `CAPTCHA_DETECTED` | Platform showed captcha |
| `ELEMENT_NOT_FOUND` | Target DOM element missing |
| `DB_CONSTRAINT` | Database constraint violation |

## Files to Create

```
src/shared/errors.ts
src/renderer/src/components/shared/ErrorBoundary.tsx
```

## Files to Modify

```
src/renderer/src/components/Layout/ThreePanel.tsx
src/main/ipc-handlers.ts
src/main/automation/extraction-runner.ts
src/main/ai/claude-service.ts
```

## Success Criteria

- [x] A crash in the chat panel does not affect the job list or browser panel
- [x] Errors include machine-readable codes
- [x] Error boundaries render a fallback UI with retry
- [x] Stack traces preserved in error logs
