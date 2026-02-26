# OpenOrbit Development Roadmap

> Internal development guide. Each phase interleaves engineering hardening with feature development. Every phase leaves the app in a shippable state.

---

## Current State Assessment

**Codebase:** All 6 phases complete. Community-driven, cross-device job automation ecosystem.

**What works (Phase 6 final state):**
- Complete Electron shell with main/preload/renderer separation
- SQLite database with WAL mode, migrations, full repository layer
- Full LinkedIn adapter (search, extraction, Easy Apply engine)
- Indeed and Upwork adapters (Phase 4)
- Claude AI integration with multi-model failover and API key rotation (Phase 3)
- Human behavior simulation (delays, typing, scrolling, idle pauses)
- Patchright-based session manager with user-data-dir profiles (Phase 2)
- Skills-based action executor (JSON + markdown format) (Phase 4)
- Memory system with sqlite-vec + FTS5 for learning (Phase 3)
- Cron scheduling with node-cron (Phase 3)
- Config hot-reload (Phase 3)
- System tray + desktop notifications (Phase 4)
- Auto-updater via GitHub Releases (Phase 4)
- WebSocket JSON-RPC 2.0 server on localhost:18790 with token auth (Phase 5)
- Monorepo: `packages/core`, `packages/cli` (Phase 5)
- CLI with 10+ commands (`search`, `apply`, `analyze`, `skills`, `adapters`, `templates`, `relay`) (Phases 5–6)
- Chrome Extension Relay (Manifest V3, CDP proxy via user's real Chrome) (Phase 6.1)
- Community marketplace: skills install/registry, adapter discovery, answer templates (Phase 6.3)
- iOS companion app (SwiftUI, QR pairing, push notifications, swipe approve/reject) (Phase 6.2)
- **502 tests passing** across 5 Vitest projects (main, core, renderer, cli, extension)

**All stubs resolved:**
- ~~`linkedin-applicator.ts`~~ → Full Easy Apply engine (Phase 2)
- ~~`indeed-adapter.ts`~~ → Full PlatformAdapter implementation (Phase 4)
- ~~`upwork-adapter.ts`~~ → Proposal-based flow (Phase 4)
- ~~`rate-limiter.ts`~~ → Sliding window + circuit breaker (Phase 2)
- ~~`notifier.ts`~~ → Electron Notification API integration (Phase 4)
- ~~`tray.ts`~~ → System tray with context menu (Phase 4)
- ~~All UI stubs~~ → Functional React components (Phases 2–3)

---

## Phase 1: Solid Foundation (COMPLETE)

**Theme:** Make what exists reliable, testable, and CI-gated. Zero new features — pure engineering hardening.

**Effort:** Moderate | **Depends on:** Nothing | **Status:** Complete

### 1.1. Testing Infrastructure

**Install and configure Vitest.**

- Add `vitest`, `@vitest/coverage-v8` to devDependencies
- Create `vitest.config.ts` at project root with separate test projects: `main` (Node env), `renderer` (jsdom env)
- Add `"test"`, `"test:watch"`, `"test:coverage"` scripts to `package.json`

**Unit tests for database repositories** (highest value per line of test code):

| Test file | What to test |
|-----------|-------------|
| `src/main/db/__tests__/jobs-repo.test.ts` | `insert()`, `getById()`, `list()` with all filter combos, `updateStatus()` timestamps, `updateAnalysis()` JSON serialization, `exists()` duplicate check, `count()` |
| `src/main/db/__tests__/profiles-repo.test.ts` | CRUD operations, search config serialization, platform enum validation |
| `src/main/db/__tests__/settings-repo.test.ts` | `get()`/`set()` with string and JSON values, default handling |
| `src/main/db/__tests__/action-log-repo.test.ts` | Action logging, timestamp accuracy, metadata JSON |
| `src/main/db/__tests__/answers-repo.test.ts` | Template CRUD, matching by question pattern |

**Pattern:** Each test creates a fresh in-memory database (`new Database(':memory:')`) and runs migrations. Mock `electron`'s `app.getPath()` to a temp directory.

**Unit tests for AI services:**

| Test file | What to test |
|-----------|-------------|
| `src/main/ai/__tests__/job-analyzer.test.ts` | `parseAnalysis()` with valid JSON, markdown-wrapped JSON, garbage input. Score clamping (>100, <0). Batch analysis continues on individual failures |
| `src/main/ai/__tests__/answer-generator.test.ts` | Answer generation with mocked Claude responses, template matching fallback |
| `src/main/ai/__tests__/chat-handler.test.ts` | Message handling, context window management |

**Pattern:** Mock `ClaudeService.complete()` via `vi.mock('./claude-service')` to return controlled responses.

**Unit tests for automation utilities:**

| Test file | What to test |
|-----------|-------------|
| `src/main/automation/__tests__/human-behavior.test.ts` | Delay ranges within min/max, `occasionalIdle()` probability, typing speed bounds |
| `src/main/automation/__tests__/hint-executor.test.ts` | Selector fallback chain, confidence threshold gating, hostname matching in `findHintFile()` |
| `src/shared/__tests__/ipc-channels.test.ts` | All IPC channel constants are unique strings |

**Success criteria:**
- `npm test` runs and passes
- `npm run test:coverage` shows >70% on `db/`, `ai/`, `automation/`
- Tests complete in <30 seconds

### 1.2. IPC Schema Validation with Zod

**Install Zod. Define schemas for every IPC channel. Validate at the boundary.**

**Create `src/shared/ipc-schemas.ts`:**
- Zod schemas for every IPC channel's request and response payloads
- Cover all 25 channels defined in `ipc-channels.ts`
- Export inferred TypeScript types alongside schemas

**Create `src/main/ipc-validation.ts`:**
- `validatedHandle(channel, schema, handler)` wrapper around `ipcMain.handle`
- On validation failure: return `{ success: false, error: zodFormattedError }` instead of crashing
- Logs validation errors to structured logger

**Refactor `src/main/ipc-handlers.ts`:**
- Replace every raw `ipcMain.handle` with `validatedHandle`
- Each handler gets compile-time typed args from the schema

**Create `src/renderer/src/lib/ipc-client.ts`:**
- Typed wrapper functions for every IPC call
- Replace raw `window.api.invoke()` in hooks with typed functions
- Compile-time safety: renderer and main agree on payload shapes

**Files to create:**
- `src/shared/ipc-schemas.ts`
- `src/main/ipc-validation.ts`
- `src/renderer/src/lib/ipc-client.ts`

**Files to modify:**
- `package.json` (add `zod`)
- `src/main/ipc-handlers.ts` (refactor all handlers)
- All renderer hooks that call `window.api.invoke()`

**Success criteria:**
- Invalid payloads return structured errors, not crashes
- TypeScript catches type mismatches across the IPC bridge at compile time

### 1.3. Error Handling

**Create structured error types in `src/shared/errors.ts`:**
- `OpenOrbitError` base class with `code`, `context`, `recoverable` fields
- Subclasses: `AuthenticationError`, `PlatformError`, `AIServiceError`, `DatabaseError`, `AutomationError`
- Each maps to a user-facing message and suggested recovery action

**Create React Error Boundary in `src/renderer/src/components/shared/ErrorBoundary.tsx`:**
- Class component with `componentDidCatch`
- Fallback UI with "Retry" button
- Logs error to main process via IPC

**Wrap each panel in `ThreePanel.tsx`:**
- `<ErrorBoundary section="left">`, `<ErrorBoundary section="center">`, `<ErrorBoundary section="right">`
- One panel crashing does not take down the others

**Refactor catch blocks in `ipc-handlers.ts`:**
- Replace `String(err)` with structured error types preserving stack traces and codes
- Machine-readable codes: `AUTH_REQUIRED`, `RATE_LIMITED`, `HINT_FAILED`, `AI_TIMEOUT`

### 1.4. CI/CD Pipeline

**Create `.github/workflows/ci.yml`:**
- **Trigger:** push to `main`, all PRs
- **Steps:** `lint` → `typecheck` → `test` → `build` (sequential gates)
- **Matrix:** build on `ubuntu-latest`, `macos-latest`, `windows-latest`; tests on ubuntu only for speed
- **Cache:** `node_modules` keyed on `package-lock.json`

**Create `.github/workflows/release.yml`:**
- **Trigger:** tag push matching `v*`
- Build on all 3 platforms, upload artifacts to GitHub Releases
- Code signing deferred to Phase 4

**Add pre-commit hooks:**
- `husky` + `lint-staged` for `prettier --check` and `eslint` on staged files

**Success criteria:**
- Every PR gets automated lint, typecheck, test, build
- Failing tests block merge
- Tagged releases produce downloadable artifacts

### 1.5. Database Hardening

**Create `src/main/db/transaction.ts`:**
- `withTransaction(fn)` helper wrapping `db.transaction()`
- Apply to `ExtractionRunner.extractFromProfile()` where multiple inserts happen in loops

**Create `src/main/db/backup.ts`:**
- Uses better-sqlite3's `backup()` API to create `.db.bak` files
- Runs before migrations and on configurable interval
- Keeps last N backups (default 5)

**Schema validation on startup:**
- After migrations, verify expected tables and columns exist
- Log warnings for schema drift

---

## Phase 2: Stealth & Resilience (COMPLETE)

**Theme:** Make automation harder to detect and more resilient. Ship anti-detection upgrades, the application engine, and core UI stubs.

**Effort:** High | **Depends on:** Phase 1 | **Status:** Complete

### 2.1. Patchright Integration

> Highest ROI task in the entire roadmap. Minimal effort, eliminates the #1 detection vector.

**Inspired by:** OpenClaw analysis Section 3 — `Runtime.enable` is the primary detection signal. Patchright patches it out.

- `npm install patchright` and update imports across the codebase
- Same API surface — no logic changes needed
- **Files to update:** `session-manager.ts`, `hint-executor.ts`, `page-reader.ts`, `human-behavior.ts`, `action-engine.ts`, `platform-adapter.ts`, `linkedin-adapter.ts`, `linkedin-extractor.ts`
- Remove redundant anti-detection init scripts that Patchright handles natively
- Verify `navigator.webdriver === false` and `__playwright__binding__` absent

### 2.2. User-Data-Dir Sessions

> Replaces JSON `storageState` with a persistent Chrome profile. LinkedIn sessions survive restarts.

**Inspired by:** OpenClaw analysis Section 3 — storageState loses IndexedDB, service workers, cache. User-data-dir preserves everything.

**Refactor `src/main/automation/session-manager.ts`:**
- Replace `chromium.launch()` + `storageState` with `chromium.launchPersistentContext(userDataDir, options)`
- User data dir: `{userData}/session/chrome-profile/`
- Remove `saveSession()`, `SESSION_STORAGE_FILENAME`, `browser-state.json` logic
- Session migration: if `browser-state.json` exists on first launch, log re-login notice

**Files to modify:**
- `src/main/automation/session-manager.ts` (major rewrite)
- `src/shared/constants.ts` (remove `SESSION_STORAGE_FILENAME`)
- `src/main/ipc-handlers.ts` (simplify `SESSION_SAVE`)

### 2.3. Rate Limiter + Circuit Breaker

**Implement `src/main/utils/rate-limiter.ts`** (currently a 2-line stub):
- Sliding window algorithm tracking: actions/minute, applications/session, extractions/session, session duration
- Persist rate limit state to SQLite for cross-restart tracking
- API: `canPerformAction()`, `recordAction()`, `getRemainingQuota()`
- Configurable limits from `AutonomySettings` constants

**Create `src/main/utils/circuit-breaker.ts`:**
- Track consecutive failures per platform
- After N failures (default 5): trip breaker, stop automation, notify UI
- Half-open state after cooldown period for retry

**Integrate into automation pipeline:**
- `ExtractionRunner` and `ActionEngine` check `rateLimiter.canPerformAction()` before each operation
- On limit hit: pause automation, emit `AUTOMATION_STATUS` with reason

### 2.4. LinkedIn Easy Apply Engine

> The highest-impact feature. `linkedin-applicator.ts` is currently a 2-line stub.

**Implement `src/main/platforms/linkedin/linkedin-applicator.ts`:**
1. Click "Easy Apply" button
2. Detect and fill multi-step form
3. Upload resume from file path
4. Detect question types (text, select, radio, checkbox)
5. Check `AnswersRepo` for known templates first, fall back to `AnswerGenerator`
6. Handle "Review" step before submission
7. Detect success/failure
8. Use `HumanBehavior` for all interactions

**Add Easy Apply hints to `hints/linkedin-jobs.json`:**
- Actions: `click_easy_apply`, `fill_contact_info`, `upload_resume`, `detect_questions`, `answer_question`, `click_next_step`, `click_review`, `click_submit`

**Wire IPC channels:**
- `APPLICATION_START`, `APPLICATION_PROGRESS`, `APPLICATION_PAUSE_QUESTION`, `APPLICATION_ANSWER`, `APPLICATION_COMPLETE`
- Pause-for-review flow when autonomy settings require it (custom questions, salary, low confidence)

### 2.5. Core UI Stubs (Jobs, Chat, Application, Browser)

**Implement the renderer stubs needed for Phase 2 features to be usable:**

| Component | What it does |
|-----------|-------------|
| `useJobs.ts` + `useBrowser.ts` hooks | Wire IPC calls to Zustand store |
| `JobCard.tsx`, `JobList.tsx`, `JobDetail.tsx`, `JobFilters.tsx`, `MatchBadge.tsx` | Job browsing and filtering UI |
| `ChatPanel.tsx`, `ChatMessage.tsx`, `ChatInput.tsx` | Claude chat interface |
| `ApplicationQueue.tsx`, `AnswerEditor.tsx`, `ResumeSelector.tsx`, `CoverLetterPreview.tsx` | Application review and editing UI |

### 2.6. Structured Logging

**Enhance `src/main/utils/logger.ts`:**
- Write logs to rotating files in `{userData}/logs/` as NDJSON
- 7-day retention, 10MB max per file
- Instrument key operations with timing: session init, page extraction, Claude API calls, DB queries

**Add `session_metrics` table (new migration):**
- Persists: total jobs extracted, analyzed, applied, errors, duration, actions/minute per session

---

## Phase 3: Autonomous Intelligence (COMPLETE)

**Theme:** Make OpenOrbit learn, schedule, and operate independently.

**Effort:** Moderate | **Depends on:** Phase 2 | **Status:** Complete

### 3.1. Multi-Model Failover + API Key Rotation

**Modify `src/main/ai/claude-service.ts`:**
- Support multiple API keys as JSON array in settings (`anthropic_api_keys`)
- On `429 Too Many Requests`: rotate to next key with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Model failover: if Opus fails, retry with Sonnet (and vice versa)
- Track per-key, per-model usage in `api_usage` SQLite table (new migration)

### 3.2. Memory System

> **Inspired by:** OpenClaw analysis Section 4C — sqlite-vec + FTS5 for hybrid vector+keyword search. Makes OpenOrbit learn from past decisions.

**Install `sqlite-vec`. Create memory tables (new migration):**
- `memory_facts`: id, category, content, embedding (F32_BLOB), created_at
- `memory_fts`: FTS5 virtual table on `memory_facts.content`
- Categories: `preference`, `company`, `pattern`, `answer`

**Create `src/main/db/memory-repo.ts`:**
- `addFact()`, `search(query)` (hybrid: vector similarity + FTS5 BM25), `getRecentFacts(category)`, `deleteFact()`

**Create `src/main/ai/memory-context.ts`:**
- Builds context strings from memory search results for injection into Claude prompts

**Integrate into AI services:**
- Before scoring: query memory for preferences and company history
- Before generating answers: query for past successful answers
- After user approve/reject: write preference fact
- After successful application: write answer facts

**Learning loop:** When user changes a Claude-generated score or answer, record correction → system improves over time.

### 3.3. Cron Scheduling

**Inspired by:** OpenClaw analysis Section 4D

**Install `node-cron`. Create `src/main/scheduler/scheduler.ts`:**
- Store schedules in SQLite `schedules` table: id, name, cron_expression, profile_id, enabled, last_run, next_run
- On trigger: invoke same flow as `AUTOMATION_START` IPC handler
- Schedulable tasks: job extraction, hint verification, DB backup, log rotation, daily summary generation

**Add IPC channels:** `SCHEDULE_LIST`, `SCHEDULE_CREATE`, `SCHEDULE_UPDATE`, `SCHEDULE_DELETE`, `SCHEDULE_TOGGLE`

**Create `src/renderer/src/components/Settings/Schedules.tsx`:**
- Schedule management UI with cron builder (daily/weekly/custom)
- Show last run, next run, status

### 3.4. Config Hot-Reload

**Inspired by:** OpenClaw analysis Section 4F

**Create `src/main/config/config-watcher.ts`:**
- `fs.watch()` on hints directory and data directory with 300ms debounce
- Emit events: `hint-changed`, `settings-changed`
- On hint change: reload `HintBasedExecutor` hint map
- On settings change: propagate to active services, reset API clients if needed
- Push `CONFIG_CHANGED` to renderer for UI refresh

### 3.5. Settings + Dashboard UI Stubs

**Implement remaining renderer stubs:**

| Component | What it does |
|-----------|-------------|
| `AutomationSettings.tsx` | Autonomy level, thresholds, pause triggers UI |
| `UserProfile.tsx` | Profile editing (name, skills, preferences) |
| `APIKeys.tsx` | Multi-key management, usage display |
| `Resumes.tsx` | Resume upload and management |
| `AnswerTemplates.tsx` | Template CRUD UI |
| `Slider.tsx` | Reusable slider component |
| `StatsCards.tsx` | Key metrics overview |
| `PipelineView.tsx` | Job pipeline visualization |
| `ActivityLog.tsx` | Scrolling activity feed |

---

## Phase 4: Platform Expansion (COMPLETE)

**Theme:** Expand beyond LinkedIn. Desktop integration. Release infrastructure.

**Effort:** High | **Depends on:** Phase 3 | **Status:** Complete

### 4.1. Indeed Adapter

**Implement `src/main/platforms/indeed/indeed-adapter.ts`:**
- Full `PlatformAdapter` interface following LinkedIn's pattern
- Indeed-specific URL construction (`q=`, `l=`, `fromage=`, `jt=`)
- Create `indeed-extractor.ts` for job card and detail extraction
- Populate `hints/indeed-jobs.json` with selectors

### 4.2. Upwork Adapter

**Implement `src/main/platforms/upwork/upwork-adapter.ts`:**
- Different model: freelance marketplace, not job board
- `applyToJob()` involves writing proposals (adapt `CoverLetterGenerator`)
- Create `upwork-extractor.ts`
- Add `UpworkProjectDetails` type with budget, timeline, client rating fields
- Populate `hints/upwork-jobs.json`

### 4.3. Skills Format Evolution

> **Inspired by:** OpenClaw analysis Section 4G — markdown-based skills with YAML frontmatter

**Create `src/main/automation/skills-loader.ts`:**
- Parse markdown + YAML frontmatter format
- Convert to internal `SiteHintFile` for backward compatibility
- Support both JSON and markdown during migration

**Migrate hints:**
- Convert `linkedin-jobs.json` → `linkedin-jobs.md` with richer natural language + selectors
- Agent can write its own skills when it solves a new page layout

### 4.4. System Tray + Desktop Notifications

**Implement `src/main/tray.ts`:**
- Menu bar icon with context menu: Show/Hide, Start/Stop automation, Quit
- Minimize to tray instead of closing

**Implement `src/main/utils/notifier.ts`:**
- Electron `Notification` API
- Triggers: high-match job found, application completed, error, scheduled run complete
- Respects user notification preferences from settings

### 4.5. Auto-Update + Release Pipeline

**Create `src/main/updater.ts`:**
- Wire `electron-updater` with GitHub Releases as publish provider
- Check for updates on launch and periodically
- Show update notification, download and install on confirmation

**Update `electron-builder.yml`:**
- Replace `example.com` placeholder with GitHub Releases provider
- Configure code signing (macOS notarization, Windows SmartScreen)

---

## Phase 5: Architecture Evolution (COMPLETE)

**Theme:** Decouple core from Electron. Ship as a platform with CLI and SDK.

**Effort:** Very High | **Depends on:** Phase 4 | **Status:** Complete

### 5.1. WebSocket RPC Layer

> **Inspired by:** OpenClaw analysis Section 2 (gateway architecture) and Section 4H

**Create `src/shared/rpc-protocol.ts`:**
- JSON-RPC 2.0 inspired: `{ id, method, params }` → `{ id, result/error }`
- Server-sent events for push (automation status, new jobs)
- 1:1 mapping to existing IPC channels

**Create `src/main/rpc/ws-server.ts`:**
- WebSocket server on `localhost:18790` (configurable)
- Token-authenticated
- Reuses same handler logic as IPC handlers

**Create `src/renderer/src/lib/ws-client.ts`:**
- Drop-in replacement for `window.api.invoke()` and `window.api.on()`
- Renderer can choose: IPC (Electron) or WebSocket (web/mobile)

**Dual transport:** Keep Electron IPC working alongside WebSocket. Feature flag to choose.

### 5.2. Monorepo Core Extraction

> **Inspired by:** OpenClaw analysis Section 5 (npm package) and Section 6 (brain vs body)

**Extract the "brain" into a standalone package:**

```
packages/
  core/                        @openorbit/core
    src/
      ai/                      (claude-service, job-analyzer, answer-generator, cover-letter, chat-handler)
      automation/               (session-manager, action-engine, hint-executor, human-behavior, page-reader, extraction-runner)
      db/                       (database, all repos)
      platforms/                (platform-adapter, linkedin/, indeed/, upwork/)
      scheduler/
      config/
      utils/
      types.ts, constants.ts
  electron/                    @openorbit/electron
    src/
      main/                     (index.ts, ipc-handlers.ts, tray.ts, updater.ts)
      preload/
      renderer/
  cli/                         @openorbit/cli
    src/
      index.ts
      commands/                 (search, apply, analyze, schedule, status, export)
```

**Dependency inversion:**
- Core takes a `Config` object instead of `app.getPath()`
- Core emits events instead of `mainWindow.webContents.send()`
- Electron's `ipc-handlers.ts` becomes a thin adapter

**Setup:**
- `pnpm-workspace.yaml` at root
- Workspace dependencies between packages
- Shared `tsconfig` base

### 5.3. CLI Tool

**Create `packages/cli/`:**
- `openorbit search --profile "senior react" --limit 20` — headless extraction
- `openorbit analyze --job-id <id>` — analyze a specific job
- `openorbit apply --job-id <id> --resume default` — apply to a job
- `openorbit schedule create --cron "0 8 * * 1-5" --profile "senior react"`
- `openorbit status` — current session status
- `openorbit export --format csv` — export jobs
- Interactive TUI mode with `@clack/prompts` when no args given

---

## Phase 6: Distributable Platform (COMPLETE)

**Theme:** Community features, cross-device experience. OpenOrbit becomes a platform.

**Effort:** Very High | **Depends on:** Phase 5 | **Status:** Complete

### 6.1. Chrome Extension Relay

> **Inspired by:** OpenClaw analysis Section 3 (Mode B: Chrome Extension Relay)

- Manifest V3 Chrome extension exposing CDP access to the user's actual tabs
- Extension connects to OpenOrbit's WebSocket server
- Maximum stealth: real profile, real cookies, real extensions, real browsing history
- No Patchright or user-data-dir needed — user is already logged in

### 6.2. Mobile Companion (iOS)

> **Inspired by:** OpenClaw analysis Section 4L and Section 6 (brain + body separation)

- Swift/SwiftUI iOS app connecting to core via WebSocket (same protocol as Phase 5.1)
- Push notifications for high-match jobs
- Swipe to approve/reject
- Application status overview
- Pairs with desktop via QR code

### 6.3. Community Marketplace

> **Inspired by:** OpenClaw analysis Section 4M

- **Skills repository:** GitHub-based marketplace, `openorbit skills install @community/glassdoor`
- **Community adapters:** Platform adapters as npm packages (`@openorbit/glassdoor`, `@openorbit/dice`)
- **Answer template sharing:** Anonymized, aggregated templates for common questions (opt-in)

---

## Phase Dependency Map

```
Phase 1: Solid Foundation
    |
    v
Phase 2: Stealth & Resilience
    |
    v
Phase 3: Autonomous Intelligence
    |
    v
Phase 4: Platform Expansion
    |
    v
Phase 5: Architecture Evolution
    |
    v
Phase 6: Distributable Platform
```

**Each phase ships a complete, usable product:**

| After Phase | OpenOrbit Is... | Status |
|-------------|----------------|--------|
| 1 | A reliable, tested, CI-gated LinkedIn extraction tool | ✅ Complete |
| 2 | A stealthy LinkedIn job searcher and applicant with anti-detection | ✅ Complete |
| 3 | A self-scheduling, learning automation agent | ✅ Complete |
| 4 | A multi-platform job automation suite with desktop integration | ✅ Complete |
| 5 | A developer platform with CLI, SDK, and WebSocket API | ✅ Complete |
| 6 | A community-driven, cross-device job automation ecosystem | ✅ Complete |

---

## Critical Files (touched across multiple phases)

| File | Phases | Role |
|------|--------|------|
| `src/main/ipc-handlers.ts` | 1, 2, 3, 4, 5 | Central IPC dispatch — Zod validation, new channels, WebSocket migration |
| `src/main/automation/session-manager.ts` | 2, 5 | Browser lifecycle — rewritten for user-data-dir, abstracted for core extraction |
| `src/main/ai/claude-service.ts` | 3, 5 | AI gateway — key rotation, failover, usage tracking, dependency inversion |
| `src/main/platforms/linkedin/linkedin-applicator.ts` | 2 | 2-line stub → full Easy Apply engine |
| `src/shared/types.ts` | All | Domain types extended every phase |
| `src/main/db/database.ts` | 1, 2, 3 | New migrations for metrics, memory, schedules, API usage |
| `package.json` | All | New dependencies every phase |

---

## OpenClaw Analysis Cross-Reference

Items from `docs/research/openclaw-analysis.md` mapped to roadmap phases:

| OpenClaw Insight | Section | Roadmap Phase |
|-----------------|---------|---------------|
| Patchright (drop-in Playwright replacement) | Section 3, Rec #1 | **Phase 2.1** |
| User-data-dir sessions | Section 3, Rec #2 | **Phase 2.2** |
| Config hot-reload | Section 4F | **Phase 3.4** |
| API key rotation | Section 4E | **Phase 3.1** |
| Cron scheduling | Section 4D | **Phase 3.3** |
| Memory system (sqlite-vec + FTS5) | Section 4C | **Phase 3.2** |
| Multi-model failover | Section 4E | **Phase 3.1** |
| Skills format (markdown) | Section 4G | **Phase 4.3** |
| WebSocket architecture | Section 4H | **Phase 5.1** |
| Chrome Extension Relay | Section 4I | **Phase 6.1** |
| Monorepo + npm | Section 5 | **Phase 5.2** |
| Mobile companion | Section 4L | **Phase 6.2** |
| Community marketplace | Section 4M | **Phase 6.3** |
| Markdown personality files (SOUL.md, MEMORY.md) | Section 7 | **Phase 3.2** (memory system) |
| Brain/body separation | Section 6 | **Phase 5.2** (core extraction) |
