# Open Hive + Minions — Build Phases

> See [SPEC.md](SPEC.md) for the full system spec.

## Phase 1: Minion Agent (validate on real hardware)
- [x] Package scaffold (package.json, tsconfig, src/)
- [x] Instruction executor with handlers: exec, read, write, http
- [x] Hardware fingerprint generation (JS port of device-info.sh)
- [x] Config loader
- [x] Local API server (direct LAN access)
- [x] Local test: run instructions from a JSON file, no network
- [ ] `bun build --compile` → binary
- [ ] Deploy to Pi, run manually, verify exec/read/write work

## Phase 2: Minimal Hive (validate communication)
- [x] Express server + `ws` server in single entry point
- [x] In-memory device registry (no DB yet)
- [x] In-memory task queue
- [x] WS auth (API key check) + hardware ID adoption on first connect
- [x] REST: POST /api/tasks, GET /api/tasks/:id, GET /api/devices, POST /api/devices
- [x] Minion WS client with auto-reconnect (exponential backoff)
- [x] End-to-end test: controller → hive → minion → result → controller
- [x] Run hive locally on MacBook first

## Phase 3: Persistence + Deploy
- [x] Railway project setup
- [x] PostgreSQL schema (Drizzle) — devices, tasks, task_results
- [x] Migrate in-memory stores to DB
- [x] Device registration flow (POST /api/devices → API key, bcrypt hashed)
- [x] Heartbeat + offline detection
- [x] API key hashing (bcrypt) on registration
- [x] Devices marked offline on hive startup (clean slate)
- [x] End-to-end test passing with PostgreSQL
- [x] Dockerfile + build script for Railway deployment
- [x] Compiled JS verified (`npm run build` → `node dist/index.js`)
- [x] Minion install script (`install.sh`) with systemd service
- [x] Deploy hive to Railway → hive.openorbit.ai
- [x] End-to-end verified: REST → Railway hive → WSS → local minion → result
- [x] Deploy minion to Pi (run install.sh)

## Phase 4: File Transfer (R2) — SKIPPED
> Deferred: inline results sufficient for current use cases (10MB limit).

## Phase 5: Controller Extension (ext-hive)
- [x] Package scaffold following OpenOrbit extension pattern
- [x] Hive REST client
- [x] IPC handlers (6 channels)
- [x] Device fleet sidebar panel
- [x] Manual task dispatch UI (workspace with dispatch form + task history)
- [x] SkillRegistry integration (5 skills: hive-exec, hive-read, hive-write, hive-http, hive-list-devices)
- [x] Shell registration (preloadedModules + vite aliases)
- [x] Build verified (main 958kB, renderer 1357kB)

## Phase 6: Web Dashboard (hive-served SPA)

A lightweight React SPA served from the hive Express server on Railway. Provides fleet visibility and task management from any browser — no OpenOrbit desktop app required.

### 6.1: Build Pipeline + Static Serving
- [x] Vite project under `packages/hive/dashboard/` (React + Tailwind)
- [x] `npm run build:dashboard` → outputs to `packages/hive/dist/dashboard/`
- [x] Express serves `dist/dashboard/` at `/` with SPA fallback (`index.html` for all non-API routes)
- [x] Auth gate: token from localStorage, validated against `/api/devices` endpoint
- [x] Login page: single password field, stores token in localStorage
- [x] Dockerfile updated to build dashboard + server

### 6.2: Device Fleet View
- [x] Device list page (`/devices`) — table with name, status (online/offline badge), type, hardware summary, location tag, last seen (relative time)
- [x] Auto-refresh every 10s (polling `/api/devices`)
- [x] Click device → detail page: full hardware info, capabilities, recent tasks
- [x] Online/offline counts in header

### 6.3: Task Dispatch + History
- [x] Dispatch page (`/tasks/new`) — device selector, instruction type (exec/read/write/http), dynamic form fields, priority selector
- [x] Submit → POST `/api/tasks`, redirect to task detail
- [x] Task list page (`/tasks`) — table with ID, device, type, status badge, priority, created at
- [x] Filters: status dropdown, device dropdown
- [x] Task detail page (`/tasks/:id`) — instruction JSON, result (stdout/stderr or file content), duration
- [x] Auto-poll running tasks every 2s until completed/failed/timeout

### 6.4: Health + Overview
- [x] Home page (`/`) — fleet summary: total devices, online count, tasks today (by status), hive uptime
- [x] Build verified: dashboard 257kB JS + 14kB CSS, hive server clean, OpenOrbit shell clean (main 958kB, renderer 1357kB)

## Phase 7: AI Agent Chat (ext-hive)

A conversational AI interface inside the ext-hive workspace. The user talks naturally ("check disk space on all minions", "install node 22 on the pi") and the AI orchestrates hive operations using tool calling. Follows the established chat handler pattern from ext-ghl.

### 7.1: Chat Handler (main process)
- [x] `HiveChatHandler` class in `ext-hive/src/main/ai/hive-chat-handler.ts`
  - Constructor accepts `AIService`, `() => HiveClient | null`, `SkillService`
  - In-memory message history (max 20 messages, auto-trim)
  - `sendMessage(message: string): Promise<string>` — public API
  - Agentic loop: `provider.completeWithTools()` → execute tool calls → feed results back → repeat (max 10 rounds)
  - Fallback for non-tool-capable providers: prefetch device list + recent tasks into system prompt, single `chat()` call
  - `clearHistory()` — resets conversation
- [x] System prompt: fleet operator assistant, acts first explains after, safety rules (no destructive commands without confirmation)
- [x] Lazy initialization on first chat message

### 7.2: Hive Tools (AI tool definitions)
- [x] `HIVE_TOOLS: AIToolDefinition[]` in `ext-hive/src/main/ai/hive-tools.ts` (8 tools)
- [x] Tools: `list_devices`, `get_device`, `exec_command`, `read_file`, `write_file`, `http_request`, `list_tasks`, `get_task`
- [x] Tool dispatch: switch on name, call HiveClient or `dispatchAndPoll` helper
- [x] Combined tools via `getCombinedTools(HIVE_TOOLS, skillService)`

### 7.3: IPC + Renderer Integration
- [x] IPC channels: `ext-hive:chat-send`, `ext-hive:chat-clear` (8 total channels now)
- [x] IPC schemas (Zod validation)
- [x] Chat state in ext-hive Zustand store: `chatMessages`, `chatLoading`, `sendChatMessage()`, `clearChat()`
- [x] IPC client methods: `ipc.chatSend(message)`, `ipc.chatClear()`

### 7.4: Agent Chat UI (renderer)
- [x] Workspace view `hive-agent` registered in package.json contributes
- [x] `HiveAgentPanel.tsx` — full-height chat panel:
  - Message list: user right-aligned, assistant left-aligned, system errors in red
  - Animated thinking indicator (3 pulsing dots)
  - Auto-scroll to bottom on new messages
  - Empty state with 4 suggested prompts
- [x] Auto-expanding textarea (max 150px), Enter to send, Shift+Enter for newline
- [x] Clear conversation button in header
- [x] Error display: system messages shown inline in red
- [x] Build verified: main 969kB (+11kB), renderer 1365kB (+8kB)

## Phase 8: Task Scheduling
- [x] `schedules` table in hive PostgreSQL (id, device_id, instruction, cron_expression, enabled, last_run_at, next_run_at, created_at)
- [x] Cron evaluator in hive server — checks schedules every 60s, creates + dispatches tasks for due schedules
- [x] REST endpoints: CRUD `/api/schedules`
- [x] Dashboard UI: schedule list (`/schedules`), create form (`/schedules/new`), enable/disable toggle, delete
- [x] ext-hive: 4 IPC channels + schedule methods in HiveClient (12 total channels)
- [x] AI agent tools: `create_schedule`, `list_schedules`, `delete_schedule` (11 total tools)
- [x] Build verified: main 975kB, preload 3.5kB, renderer 1366kB; dashboard 263kB JS + 14kB CSS

## Phase 9: Task Chains / Workflows
- [x] Workflow definition: `WorkflowStep` type — name, deviceId, instruction, onSuccess, onFailure, passOutputAs
- [x] `workflows`, `workflow_runs`, `workflow_step_runs` tables (V3 migration)
- [x] `WorkflowRunner` — sequential async executor, polls task completion, substitutes `${VAR}` in instructions
- [x] Conditional branching: `onSuccess` / `onFailure` step index overrides per step
- [x] stdout passing between steps via `passOutputAs` variable name
- [x] REST endpoints: GET/POST/DELETE `/api/workflows`, GET `/api/workflows/:id/runs`, POST `/api/workflows/:id/run`, GET `/api/workflow-runs/:id`
- [x] Dashboard: Workflows list with inline Run button, WorkflowNew step builder, WorkflowRunDetail with live polling + step output
- [x] AI agent tools: `list_workflows`, `create_workflow`, `run_workflow`, `get_workflow_status` (15 total tools)
- [x] Build verified: main 978kB, renderer 1366kB; dashboard 277kB JS + 16kB CSS

## Phase 10: Device Groups + Broadcast
- [x] `device_groups` table (id, name, description, tag_filter) — V4 migration
- [x] Tag-based membership: devices matching tag filter (locationTag equality) belong to group
- [x] Broadcast: POST `/api/groups/:id/broadcast` → fan-out to all online members, returns `{ taskCount, tasks }`
- [x] Group REST endpoints: GET/POST `/api/groups`, GET/DELETE `/api/groups/:id`, GET `/api/groups/:id/members`
- [x] Dashboard: Groups list (member + online counts, inline broadcast form), GroupNew create form
- [x] AI agent tools: `list_groups`, `create_group`, `broadcast_command` (18 total tools)
- [x] Build verified: main 978kB, renderer 1366kB; dashboard 284kB JS + 17kB CSS

## Phase 11: Monitoring + Alerts
- [x] Minion metrics collector: CPU% (loadavg/cores), RAM% (os.freemem/totalmem) — reported in every heartbeat
- [x] `device_metrics` table (30s granularity, auto-prune after 7 days) — V5 migration
- [x] Alert rules: configurable thresholds (cpu > X%, mem > X%, device offline) — per-device or global
- [x] `alerts` table (rule_id, device_id, triggered_at, resolved_at, notified) — auto-resolve when metric drops
- [x] Notification channel: Telegram Bot API direct from hive (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID env vars)
- [x] Dashboard: Monitoring page (sparklines + metric bars per device), Alert Rules page (create/delete), Alerts page (active/resolved, manual resolve)
- [x] AI agent tools: `get_device_metrics`, `list_alerts` (20 total tools in HiveChatHandler)

## Phase 12: Minion Auto-Update
- [x] Version field: `src/version.ts` (MINION_VERSION const), included in auth + heartbeat
- [x] Hive tracks latest version via env vars: `MINION_LATEST_VERSION`, `MINION_DOWNLOAD_URL`, `MINION_CHECKSUM` — stored per-device in `devices.minion_version` (V6 migration)
- [x] REST endpoint: `GET /minion/latest` → `{ version, downloadUrl, checksum }` (public, no auth)
- [x] `POST /api/minion/update/:deviceId` + `POST /api/minion/update-all` — dispatches self-update tasks
- [x] Minion `self-update` instruction: download binary, SHA256 verify, replace via `copyFileSync`, restart via `systemctl` or process re-spawn (2s delay after returning result)
- [x] Dashboard: version column (amber if outdated), per-device Update button, "Update All (N)" button for online outdated minions
- [x] AI agent tools: `check_minion_versions`, `update_minion` (22 total tools in HiveChatHandler)
