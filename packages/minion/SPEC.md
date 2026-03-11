# Open Hive + Minions — Spec

> Source of truth for all hive/minion development decisions.
> Do not deviate without flagging the conflict first.

---

## Problem Statement

OpenOrbit runs on a single MacBook. Tasks like web scraping, data collection, and automation are bottlenecked by one machine, one IP, one network. Cheap devices (Raspberry Pi, old PCs, Mac Minis) sit idle. There is no way to distribute work across them.

## Goal

A distributed compute network where:
- Low-spec devices ("minions") execute simple instructions (shell, file I/O, HTTP)
- AI reasoning stays on capable devices ("controllers")
- A central relay ("hive") connects them

## Success Criteria

- A minion agent runs reliably on a Raspberry Pi 4 as a systemd service
- The hive dispatches tasks and collects results with no manual intervention
- A controller (OpenOrbit) can send a task and receive results through the hive
- Minions auto-reconnect after network drops
- The system works with 1 minion and scales to N without architectural changes

## Non-Goals (Out of Scope)

- AI inference on minions
- iPad/mobile controller app
- Device groups and broadcast targeting
- Task scheduling (cron-like)
- Encrypted secret delivery
- Minion auto-update mechanism
- Multi-tenant / multi-user auth
- Direct device-to-device communication (all traffic goes through hive)

These may be added later. They are not part of this spec.

---

## Architecture

```
Controller (MacBook / OpenOrbit)
    │
    │  REST API (HTTPS)
    ▼
Hive (Railway — Node.js + PostgreSQL)
    │
    │  WebSocket (WSS, outbound from minions)
    ▼
Minions (Pi, PC, Mac Mini — dumb workers)
```

Three components. Three packages. Clear boundaries.

| Component | Role | Where it runs | AI? |
|---|---|---|---|
| Hive | Relay + task queue + device registry | Railway | No |
| Minion | Execute instructions, report results | Any device | No |
| Controller | Compose tasks, receive results, AI reasoning | MacBook (OpenOrbit) | Yes |

---

## Component Specs

### 1. Minion Agent

**What it is:** A single compiled binary that connects to the hive, listens for instructions, executes them, and reports results. Stateless. No AI. No DB.

**Package:** `packages/minion/`

**Boot sequence:**
1. Read config from `/etc/hive-minion/config.json`
2. Collect hardware info (device-info.sh or equivalent in JS)
3. Compute hardware fingerprint (sha256 of serial + UUID + MAC)
4. WebSocket connect to hive (WSS)
5. Authenticate with API key + hardware ID
6. Register capabilities
7. Enter instruction loop
8. On disconnect: exponential backoff retry (5s, 10s, 30s, 60s, cap at 60s)

**Config file:** `/etc/hive-minion/config.json`
```json
{
  "hiveUrl": "wss://hive.yourdomain.com",
  "apiKey": "<device-api-key>",
  "deviceName": "minion-01-pi4",
  "tags": ["home-1", "raspberry-pi"],
  "allowedOps": ["read", "write", "exec", "upload", "download", "http"],
  "workDir": "/home/pi/hive-workspace"
}
```

**Instruction types:**

| Type | Input | Output | What it does |
|---|---|---|---|
| `exec` | command, cwd, timeout, env | exitCode, stdout, stderr, durationMs | Spawns shell command |
| `read` | path, encoding, maxBytes | content | Reads a file |
| `write` | path, content, mode | bytesWritten | Writes a file |
| `upload` | localPath, remotePath | url | Uploads file to R2 |
| `download` | url, localPath, mode | bytesDownloaded | Downloads file from R2 |
| `http` | method, url, headers, body, timeout | status, headers, body | Makes HTTP request |

**Permissions:**
The minion agent has full control over the device, constrained only by its OS user permissions and the `allowedOps` config. With `exec` enabled and sudo access, it is effectively root. Security relies on the hive auth layer — only authenticated controllers can issue instructions.

**Safety constraints:**
- `exec` has a configurable timeout (default 60s, max 10min)
- File ops restricted to `workDir` unless config explicitly allows otherwise
- `allowedOps` whitelist — minion rejects instruction types not in its config
- No instruction can modify the minion binary or config
- Output capped at `maxOutputBytes` (default 10MB, configurable in config.json); larger results should use `upload`

**Local API (direct LAN access):**
The minion runs a small HTTP server on a configurable port (default `18791`). This allows sending instructions directly over the LAN without routing through the hive — useful for development, quick commands, or when the hive is unreachable.

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/exec` | API key | Execute an instruction |
| GET | `/status` | None | Health check + device info |

Auth: same API key as hive auth, passed via `Authorization: Bearer <key>`. The local API accepts the same instruction JSON format as the hive WebSocket protocol.

The local API is optional — enabled via `localApi.enabled` in config. It binds to `0.0.0.0` by default (reachable from LAN).

```json
{
  "localApi": {
    "enabled": true,
    "port": 18791,
    "bind": "0.0.0.0"
  }
}
```

**Deployment:**
- Compiled via `bun build --compile` → single binary (~5MB)
- Installed as systemd service (Linux) or launchd plist (macOS)
- Install script served by hive at `/minion/install.sh`

**Hardware fingerprint:**
```
hardware_id = sha256(pi_serial + dmi_uuid + machine_id + mac_address)
```
Priority: Pi serial > DMI UUID > machine-id. Combined with MAC. Stored locally and sent on every connect. Hive uses it to match device to its record.

---

### 2. Hive (Central Relay)

**What it is:** A lightweight Node.js server. Message passing and task queue. No AI, no heavy compute.

**Package:** `packages/hive/`

**Hosted on:** Railway (hobby plan)

**Tech stack:**
- Node.js + Express (REST API)
- `ws` library (WebSocket server)
- PostgreSQL (Railway managed)
- Drizzle ORM (migrations + queries)
- Optional: static HTML dashboard (served from same deployment)

**REST API (Controller → Hive):**

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/devices` | Controller key | Register a new device, returns API key |
| GET | `/api/devices` | Controller key | List all devices + status |
| GET | `/api/devices/:id` | Controller key | Single device detail |
| DELETE | `/api/devices/:id` | Controller key | Remove a device |
| POST | `/api/tasks` | Controller key | Create and dispatch a task |
| GET | `/api/tasks/:id` | Controller key | Task status + result |
| GET | `/api/tasks` | Controller key | List tasks (filterable) |
| GET | `/api/health` | None | Health check |
| GET | `/minion/install.sh` | None | Serve install script |

**WebSocket Protocol (Hive ↔ Minion):**

Minion connects:
```json
{ "type": "auth", "apiKey": "xxx", "hardwareId": "abc123", "deviceInfo": {...} }
```

Hive sends instruction:
```json
{ "messageId": "msg-001", "taskId": "task-abc", "instruction": { "type": "exec", "command": "df -h", "timeout": 30000 } }
```

Minion sends result:
```json
{ "messageId": "msg-001", "taskId": "task-abc", "status": "completed", "result": { "exitCode": 0, "stdout": "...", "stderr": "", "durationMs": 120 } }
```

Heartbeat: minion sends every 30s, hive responds with ack + pending task count. If no heartbeat for 90s, hive marks device offline.

**Database schema (PostgreSQL):**

Tables: `devices`, `tasks`, `task_results`

`devices`:
- id (TEXT PK) — friendly name
- hardware_id (TEXT UNIQUE) — fingerprint
- api_key_hash (TEXT) — bcrypt
- name, type, capabilities (JSONB), location_tag
- status (online/offline/busy), last_seen_at, ip_address
- hardware_info (JSONB), created_at, updated_at

`tasks`:
- id (TEXT PK)
- created_by (FK devices), target_device (FK devices, nullable for broadcast)
- priority (low/normal/high/critical), status (queued/dispatched/running/completed/failed/timeout)
- instruction (JSONB), dispatched_at, completed_at, created_at

`task_results`:
- id (TEXT PK)
- task_id (FK tasks), device_id (FK devices)
- status (success/error/timeout), result (JSONB), duration_ms, created_at

**Auth model:**
- Each device has a unique API key, stored hashed
- Controllers use Bearer token in REST requests
- Minions authenticate on WS connect with API key + hardware ID
- No multi-tenant — single owner, personal infrastructure

**Task dispatch logic:**
1. Task created via REST → stored with status `queued`
2. If target device is online → send via WS immediately, status → `dispatched`
3. If target device is offline → stays `queued`, dispatched on reconnect
4. Minion starts execution → status → `running`
5. Minion sends result → status → `completed` or `failed`
6. Timeout: if no result within instruction timeout + 30s buffer → status → `timeout`

---

### 3. Controller Integration (ext-hive)

**What it is:** An OpenOrbit extension that talks to the hive REST API. Lets the user see devices, dispatch tasks, and view results from within OpenOrbit.

**Package:** `packages/extensions/ext-hive/`

**Capabilities:**
- Hive REST API client (list devices, create tasks, poll results)
- IPC handlers for renderer (device list, task dispatch, result view)
- Registers as a skill in SkillRegistry — AI can dispatch to minions as a tool
- Device fleet panel in OpenOrbit sidebar
- Manual task dispatch UI

**Not in first version:**
- Task chain builder UI
- Live WebSocket feed from hive

---

### 4. Web Dashboard (hive-served SPA)

**What it is:** A lightweight React SPA served directly from the hive Express server on Railway. Provides fleet visibility and task management from any browser without the OpenOrbit desktop app.

**Location:** `packages/hive/dashboard/` (Vite + React + Tailwind)

**Build:** `npm run build:dashboard` → `packages/hive/dist/dashboard/` → served by Express at `/`

**Auth:**
- Login page with single password field
- Token validated against `CONTROLLER_API_KEY` env var
- Stored in localStorage, sent as `Authorization: Bearer` header on all API calls
- No session server-side — stateless token check (same as REST API auth)

**Pages:**

| Route | Purpose |
|---|---|
| `/` | Fleet overview: device counts, task stats today, hive uptime |
| `/devices` | Device table: name, status badge, type, hardware, location, last seen |
| `/devices/:id` | Device detail: full hardware info, capabilities, recent tasks |
| `/tasks` | Task list: filterable by status, device, date range |
| `/tasks/new` | Dispatch form: device selector, instruction type, dynamic fields, priority |
| `/tasks/:id` | Task detail: instruction, status timeline, result (stdout/stderr), duration |
| `/login` | Password field → stores token in localStorage |

**Tech choices:**
- Vite for build (fast, small output)
- React + Tailwind (consistent with OpenOrbit renderer)
- No state management library — React state + fetch is sufficient for read-heavy views
- Polling for live updates (10s for device list, 2s for running tasks)

**Routing:** Express serves `index.html` for all non-`/api/` and non-`/minion/` routes (SPA fallback). API routes unchanged.

**Constraints:**
- Must not increase Railway memory footprint significantly (static files only)
- No WebSocket connection from dashboard to hive (polling only — keeps it simple)
- No AI features in the dashboard (that lives in ext-hive Phase 7)

---

### 5. AI Agent Chat (ext-hive)

**What it is:** A conversational AI interface inside the ext-hive OpenOrbit extension. The user talks naturally and the AI orchestrates hive operations using tool calling. Follows the established chat handler pattern (ext-ghl).

**Location:** `packages/extensions/ext-hive/src/main/ai/` (main process) + `packages/extensions/ext-hive/src/renderer/` (UI)

**Interaction model:**
- Human-like: "make sure all minions have node 22 installed", "check disk space on the pi", "what's the uptime on minion-01?"
- AI figures out which devices to target, what commands to run, executes through hive, and summarizes results
- Multi-step: AI can chain tool calls (list devices → exec on each → report aggregate results)

**Main process — HiveChatHandler:**

```
HiveChatHandler {
  constructor(ai: AIService, client: HiveClient, skills: SkillService)
  sendMessage(message: string): Promise<string>
  clearHistory(): void
}
```

- Agentic loop: `provider.completeWithTools()` → execute tool calls → feed results back → repeat
- Max 10 tool rounds (higher than ext-ghl's 5 — fleet ops often need multi-device iteration)
- In-memory history: max 20 messages, auto-trim oldest
- Lazy initialization on first chat message
- Fallback for non-tool-capable providers: prefetch device list into system prompt

**System prompt principles:**
- You are a fleet operator assistant managing a distributed compute network
- You know device names, capabilities, and current status
- Prefer acting over asking — execute commands and show results
- Explain what you did after acting, not before
- For multi-device operations, iterate over devices and aggregate results
- Never generate destructive commands (rm -rf, dd, format) without explicit confirmation
- Safety: refuse to modify minion config/binary, refuse to expose API keys

**Tools (8 tools, mapped to existing HiveClient methods):**

| Tool | Description | Backed by |
|---|---|---|
| `list_devices` | List all devices with status and hardware info | `HiveClient.listDevices()` |
| `get_device` | Get single device detail | `HiveClient.getDevice(id)` |
| `exec_command` | Execute shell command on a device | `dispatchAndPoll()` with exec instruction |
| `read_file` | Read file from a device | `dispatchAndPoll()` with read instruction |
| `write_file` | Write file to a device | `dispatchAndPoll()` with write instruction |
| `http_request` | Make HTTP request from a device | `dispatchAndPoll()` with http instruction |
| `list_tasks` | List recent tasks (filterable) | `HiveClient.listTasks()` |
| `get_task` | Get task detail + results | `HiveClient.getTask(id)` |

Tool dispatch reuses existing `dispatchAndPoll()` helper from Phase 5 skills. Combined with OpenOrbit skill tools via `getCombinedTools()`.

**IPC channels (2 new):**
- `ext-hive:chat-send` — send message, returns AI response string
- `ext-hive:chat-clear` — clear conversation history

**Renderer — HiveAgentPanel:**
- New workspace view: `hive-agent` (registered in package.json contributes)
- Message list: user right-aligned, assistant left-aligned with markdown rendering
- Thinking indicator while AI works (agentic loop may take 10-30s for multi-device ops)
- Auto-scroll to bottom on new messages
- Empty state with suggested prompts:
  - "What devices are online?"
  - "Check disk space on all minions"
  - "Install python3 on minion-01"
  - "Run `uptime` on every device"
- Auto-expanding textarea, Enter to send, Shift+Enter for newline
- Clear conversation button in header
- Errors shown inline as system messages

**State management:**
- `chatSlice` in ext-hive Zustand store: `chatMessages`, `chatLoading`, `sendChatMessage()`, `clearChat()`
- Same pattern as ext-ghl chatSlice

**What the user does NOT see:**
- Individual tool calls and results (hidden inside agentic loop)
- The AI's internal reasoning about which tools to call
- Raw JSON responses from hive API

The user sees only the final summary: "All 3 minions have node 22.x installed. minion-01: v22.11.0, minion-02: v22.11.0, minion-03: v22.9.0."

---

## File Transfer

| Size | Channel | Example |
|---|---|---|
| < 1 MB | Inline via WebSocket/REST | Config files, script output, JSON |
| 1 MB – 1 GB | Cloudflare R2 (object storage) | Screenshots, logs, scraped data |

**R2 setup:** Cloudflare R2 free tier (10GB storage, 10M reads/mo). Both minions and controllers have R2 credentials. Hive passes URLs, not file contents.

---

## Self-Healing

When a task fails, the controller (AI) can analyze stderr and send fix-up instructions before retrying. This is controller logic, not hive or minion logic.

**Rules:**
- Max 3 auto-fix attempts per task
- Never auto-generate destructive commands (rm, format, dd)
- All fix-up commands logged as separate tasks for audit
- Escalate to user if auto-fix fails

**Common patterns:**

| stderr | Fix |
|---|---|
| `command not found: python3` | `sudo apt install -y python3` |
| `No module named 'xxx'` | `pip3 install xxx` |
| `permission denied` | Re-run with `sudo` |
| `No space left on device` | `sudo apt clean && sudo journalctl --vacuum-size=50M` |

---

## Naming Conventions

- Devices: `minion-{number}-{model}` (e.g., `minion-01-pi4`)
- IPC channels: lowercase kebab-case matching `/^[a-z-]+:[a-z-]+$/`
- Hive extension channels: `hive:*`

---

## Constraints

- Railway hobby plan ($5/mo) — limited compute, must stay lightweight
- R2 free tier — 10GB storage, 10M reads/mo
- Minion binary must run on arm64 (Pi 4) and x86_64
- All connections over TLS (Railway provides HTTPS + WSS)
- Minions only make outbound connections — no inbound ports
- Single owner, personal infrastructure — no multi-tenant concerns

---

## Open Questions

- Domain name for hive? (needed for WSS URL and install scripts)
- R2 bucket naming / access pattern? (public read or presigned URLs)
- Should the hive dashboard require auth, or is it fine behind the domain?

---

## Current Hardware

| Device ID | Model | Arch | RAM | Storage | OS | Location |
|---|---|---|---|---|---|---|
| minion-01-pi4 | Raspberry Pi 4 Model B Rev 1.2 | aarch64 | 4 GB | 238 GB SSD | Debian 11 | Home |

More devices will be added as acquired. The architecture supports N minions with no changes.
