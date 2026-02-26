# 9.2: Browser Cleanup After Extraction

**Effort:** Low | **Status:** Complete

## Background

After extraction completes (whether triggered by cron or manually), the managed browser session stays open. Users see a lingering browser window with no clear reason. This subphase wraps the extraction handler in `try/finally` to close the browser session when done.

## Tasks

### Browser Session Cleanup

- [x] Edit `packages/extensions/ext-jobs/src/main/index.ts`
  - Wrap coordinator calls in `try/finally`
  - Close browser session in `finally` block
  - Inner `try/catch` prevents cleanup errors from masking extraction errors

```typescript
async (config) => {
  await context.services.browser.ensureReady()
  const coordinator = getExtJobsCoordinator(context)
  if (coordinator.isRunning()) { ... return }
  try {
    // ... existing extraction logic ...
  } finally {
    try {
      const session = context.services.browser.getSession()
      await session.close()
    } catch (err) {
      log.warn('Failed to close browser after extraction', err)
    }
  }
}
```

This applies to both scheduled and manual triggers. The inner `try/catch` prevents cleanup errors from masking extraction errors.

## Files

| File | Action |
|------|--------|
| `packages/extensions/ext-jobs/src/main/index.ts` | EDIT — session.close() in finally block |

## Success Criteria

- [x] Browser session closes automatically after extraction completes
- [x] Browser session closes even if extraction throws an error
- [x] Cleanup errors are logged but do not mask extraction errors
