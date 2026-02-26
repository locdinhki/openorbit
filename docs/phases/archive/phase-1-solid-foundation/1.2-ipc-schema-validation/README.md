# 1.2: IPC Schema Validation with Zod

**Effort:** Moderate | **Status:** Complete

## Goal

Add runtime schema validation to all 25 IPC channels using Zod. Catch type mismatches at the process boundary before they become silent data corruption.

## Tasks

### Setup
- [x] Install `zod` as a dependency (runs in both main and renderer)

### Schema Definitions
- [x] Create `src/shared/ipc-schemas.ts`
  - Zod schemas for every IPC channel's request and response payloads
  - Cover all 25 channels from `ipc-channels.ts`:
    - Automation: `AUTOMATION_START`, `AUTOMATION_STOP`, `AUTOMATION_PAUSE`, `AUTOMATION_STATUS`
    - Jobs: `JOBS_LIST`, `JOBS_UPDATE`, `JOBS_APPROVE`, `JOBS_REJECT`, `JOBS_NEW`
    - Profiles: `PROFILES_LIST`, `PROFILES_CREATE`, `PROFILES_UPDATE`, `PROFILES_DELETE`
    - Chat: `CHAT_SEND`, `CHAT_RESPONSE`, `CHAT_ANALYZE_JOB`
    - Application: `APPLICATION_START`, `APPLICATION_PROGRESS`, `APPLICATION_PAUSE_QUESTION`, `APPLICATION_ANSWER`, `APPLICATION_COMPLETE`
    - Browser/Session: `BROWSER_NAVIGATE`, `BROWSER_SCREENSHOT`, `SESSION_INIT`, `SESSION_STATUS`, `SESSION_LOGIN`, `SESSION_SAVE`, `SESSION_CLOSE`
    - Settings: `SETTINGS_GET`, `SETTINGS_UPDATE`
    - Action Log: `ACTION_LOG_NEW`
  - Export inferred TypeScript types alongside schemas

### Validation Middleware
- [x] Create `src/main/ipc-validation.ts`
  - `validatedHandle(channel, schema, handler)` wrapper
  - On validation failure: return `{ success: false, error: zodFormattedError }`
  - Log validation errors via structured logger

### Apply to Handlers
- [x] Refactor `src/main/ipc-handlers.ts` to use `validatedHandle()` for every channel
  - Mechanical refactor: each handler gets a schema, arg type becomes inferred

### Type-Safe Renderer Client
- [x] Create `src/renderer/src/lib/ipc-client.ts`
  - Typed wrapper functions for every IPC call
  - Compile-time type safety matching the Zod schemas
- [x] Update renderer hooks to use typed client:
  - `src/renderer/src/hooks/useAutomation.ts`
  - `src/renderer/src/hooks/useJobs.ts`
  - `src/renderer/src/hooks/useProfiles.ts`
  - `src/renderer/src/hooks/useChat.ts`

## Files to Create

```
src/shared/ipc-schemas.ts
src/main/ipc-validation.ts
src/renderer/src/lib/ipc-client.ts
```

## Files to Modify

```
package.json (add zod)
src/main/ipc-handlers.ts (refactor all handlers)
src/renderer/src/hooks/useAutomation.ts
src/renderer/src/hooks/useJobs.ts
src/renderer/src/hooks/useProfiles.ts
src/renderer/src/hooks/useChat.ts
```

## Success Criteria

- [x] Every IPC handler validates inputs at runtime
- [x] TypeScript catches type mismatches across IPC at compile time
- [x] Invalid payloads return structured error messages, not crashes
- [x] Unit tests for schema validation pass
