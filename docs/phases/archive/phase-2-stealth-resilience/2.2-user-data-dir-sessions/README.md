# 2.2: User-Data-Dir Sessions

**Effort:** Moderate | **Status:** Complete

## Background

From [OpenClaw Analysis Section 3](../../research/openclaw-analysis.md): Current `storageState` exports only cookies + localStorage as JSON. LinkedIn uses IndexedDB, service workers, and cache storage — all lost between sessions, causing frequent re-logins and reducing anti-detection legitimacy.

User-data-dir persists a real Chrome profile with everything intact.

## What We Gain

| Factor | storageState (current) | user-data-dir (target) |
|--------|----------------------|----------------------|
| Cookies | JSON serialization | Native format |
| IndexedDB | Lost | Persists |
| Service Workers | Lost | Persists |
| Cache | Lost | Persists |
| Browsing history | Lost | Persists (adds legitimacy) |
| Session cookies | Fragile | Reliable |

## Tasks

### Refactor SessionManager
- [x] Replace `chromium.launch()` + `browser.newContext({ storageState })` with `chromium.launchPersistentContext(userDataDir, options)`
- [x] User data dir: `{userData}/session/chrome-profile/`
- [x] Remove `saveSession()` and all `storageState` logic
- [x] Keep anti-detection args (`--disable-blink-features=AutomationControlled`, etc.)

### Cleanup
- [x] Remove `SESSION_STORAGE_FILENAME` from `src/shared/constants.ts`
- [x] Remove `browser-state.json` references
- [x] Simplify or remove `SESSION_SAVE` IPC handler

### Migration
- [x] On first launch after upgrade: if `browser-state.json` exists, log a message that user needs to re-login (one-time cost)
- [x] Delete the old state file after migration

## Files to Modify

```
src/main/automation/session-manager.ts (major rewrite)
src/shared/constants.ts (remove SESSION_STORAGE_FILENAME)
src/main/ipc-handlers.ts (update SESSION_SAVE)
```

## Success Criteria

- [x] LinkedIn sessions survive app restarts without re-login
- [x] IndexedDB data persists between sessions
- [x] Chrome profile directory grows naturally over time
