# 1.1: Testing Infrastructure

**Effort:** Moderate | **Status:** Complete

## Goal

Set up Vitest and write unit tests for the three core layers: database repos, AI services, and automation utilities.

## Tasks

### Setup
- [x] Install `vitest`, `@vitest/coverage-v8` as devDependencies
- [x] Create `vitest.config.ts` with separate test projects: `main` (Node env), `renderer` (jsdom env)
- [x] Add `"test"`, `"test:watch"`, `"test:coverage"` scripts to `package.json`
- [x] Configure path aliases to match `electron.vite.config.ts`

### Database Repo Tests
Each test creates a fresh in-memory database (`new Database(':memory:')`) and runs migrations. Mock `electron`'s `app.getPath()` to a temp directory.

- [x] `src/main/db/__tests__/jobs-repo.test.ts`
  - `insert()` creates job with UUID and timestamps
  - `getById()` returns null for nonexistent ID
  - `list()` with all filter combinations (status, platform, profileId, minScore)
  - `updateStatus()` sets reviewed_at/applied_at correctly
  - `updateAnalysis()` serializes red_flags/highlights as JSON
  - `exists()` with duplicate external_id + platform
  - `count()` with and without status filter
- [x] `src/main/db/__tests__/profiles-repo.test.ts`
  - CRUD operations
  - Search config serialization/deserialization
  - Platform enum validation
- [x] `src/main/db/__tests__/settings-repo.test.ts`
  - `get()`/`set()` with string and JSON values
  - Default handling for missing keys
- [x] `src/main/db/__tests__/action-log-repo.test.ts`
  - Action logging with correct timestamps
  - Metadata JSON serialization
- [x] `src/main/db/__tests__/answers-repo.test.ts`
  - Template CRUD
  - Matching by question pattern

### AI Service Tests
Mock `ClaudeService.complete()` via `vi.mock('./claude-service')` to return controlled responses.

- [x] `src/main/ai/__tests__/job-analyzer.test.ts`
  - `parseAnalysis()` with valid JSON, markdown-wrapped JSON, and garbage input
  - Score clamping (values > 100 and < 0)
  - `analyzeBatch()` continues on individual failures
- [x] `src/main/ai/__tests__/answer-generator.test.ts`
  - Answer generation with mocked responses
  - Template matching fallback
- [x] `src/main/ai/__tests__/chat-handler.test.ts`
  - Message handling, context window management

### Automation Utility Tests
- [x] `src/main/automation/__tests__/human-behavior.test.ts`
  - Delay ranges within min/max bounds
  - `occasionalIdle()` probability (mock Math.random)
  - Typing speed bounds
- [x] `src/main/automation/__tests__/hint-executor.test.ts`
  - Selector fallback chain (first fails, second succeeds)
  - Confidence threshold gating
  - Hostname matching in `findHintFile()`

### Shared Tests
- [x] `src/shared/__tests__/ipc-channels.test.ts`
  - All IPC channel constants are unique strings
  - No duplicate values

## Files to Create

```
vitest.config.ts
src/main/db/__tests__/jobs-repo.test.ts
src/main/db/__tests__/profiles-repo.test.ts
src/main/db/__tests__/settings-repo.test.ts
src/main/db/__tests__/action-log-repo.test.ts
src/main/db/__tests__/answers-repo.test.ts
src/main/ai/__tests__/job-analyzer.test.ts
src/main/ai/__tests__/answer-generator.test.ts
src/main/ai/__tests__/chat-handler.test.ts
src/main/automation/__tests__/human-behavior.test.ts
src/main/automation/__tests__/hint-executor.test.ts
src/shared/__tests__/ipc-channels.test.ts
```

## Files to Modify

```
package.json (add vitest deps and scripts)
tsconfig.node.json (possibly add test paths)
```

## Success Criteria

- [x] `npm test` runs and passes all tests
- [x] `npm run test:coverage` shows >70% on `db/`, `ai/`, `automation/`
- [x] Tests complete in <30 seconds
