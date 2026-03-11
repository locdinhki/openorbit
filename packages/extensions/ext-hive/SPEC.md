# ext-hive — Controller Extension Spec

> OpenOrbit extension for managing the hive minion fleet.
> Implements Phase 5 from the [hive/minion SPEC](../../minion/SPEC.md).

---

## Problem

The hive REST API works, but interacting with it requires raw curl commands. There's no way to see device status, dispatch tasks, or view results from within OpenOrbit. The AI also can't use minions as tools.

## Goal

An OpenOrbit extension that:
1. Shows the minion fleet in a sidebar panel (status, hardware, last seen)
2. Lets the user dispatch tasks to a specific device from a workspace tab
3. Registers skills so the AI can dispatch instructions to minions as tool calls

## Non-Goals

- Real-time WebSocket feed from hive (polling on user action is sufficient)
- AI-powered task composition (describe goal → AI generates instructions)
- Task chain builder / DAG execution
- Device provisioning (use install.sh + REST API directly)
- Broadcast / multi-device dispatch (single target per task)

---

## Architecture

```
OpenOrbit Shell
├── ext-hive (main process)
│   ├── HiveClient        — typed REST client for hive API
│   ├── IPC handlers       — bridge renderer ↔ HiveClient
│   └── Skills             — hive-exec, hive-read, hive-write, hive-http
│
├── ext-hive (renderer)
│   ├── HiveSidebar        — device fleet list
│   └── HiveWorkspace      — task dispatch + result viewer
│
└── Hive REST API (Railway)
    ├── GET  /api/devices
    ├── GET  /api/devices/:id
    ├── POST /api/tasks
    ├── GET  /api/tasks/:id
    └── GET  /api/tasks?deviceId=...&status=...&limit=...
```

No local database. All state lives on the hive. The extension is a pure client.

---

## Settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `hive.url` | string | `""` | Hive base URL (e.g. `https://openhive-web-production.up.railway.app`) |
| `hive.api-key` | password | `""` | Controller API key (Bearer token for REST) |

Extension is inactive (no sidebar, no skills) until both settings are configured.

---

## HiveClient (REST Client)

Typed wrapper around the hive REST API. Lives in `src/main/hive-client.ts`.

```typescript
class HiveClient {
  constructor(baseUrl: string, apiKey: string)

  // Devices
  listDevices(): Promise<Device[]>
  getDevice(id: string): Promise<Device>

  // Tasks
  createTask(params: { targetDevice: string; instruction: Instruction; priority?: Priority }): Promise<Task>
  getTask(id: string): Promise<Task & { results: TaskResult[] }>
  listTasks(filter?: { deviceId?: string; status?: TaskStatus; limit?: number }): Promise<Task[]>

  // Health
  health(): Promise<{ status: string; uptime: number }>
}
```

All methods throw on non-2xx responses. No retry logic — the caller handles errors.

Types (`Device`, `Task`, `TaskResult`, `Instruction`) mirror the hive's Drizzle schema, minus `apiKeyHash`.

**Lifecycle:** `HiveClient` is recreated when `hive.url` or `hive.api-key` settings change. Skills and IPC handlers access the client via a getter (`() => HiveClient`), never a stale reference.

---

## IPC Channels

| Channel | Direction | Args | Returns | Purpose |
|---------|-----------|------|---------|---------|
| `ext-hive:list-devices` | invoke | `{}` | `Device[]` | Fetch all devices |
| `ext-hive:get-device` | invoke | `{ id }` | `Device` | Single device detail |
| `ext-hive:dispatch-task` | invoke | `{ targetDevice, instruction, priority? }` | `Task` | Create + dispatch a task |
| `ext-hive:get-task` | invoke | `{ id }` | `Task & { results }` | Task detail + results |
| `ext-hive:list-tasks` | invoke | `{ deviceId?, status?, limit? }` | `Task[]` | Filtered task list |
| `ext-hive:health` | invoke | `{}` | `{ status, uptime }` | Hive health check |

All channels return `{ success: true, data: T }` or `{ success: false, error: string }`.

---

## UI

### Sidebar: Device Fleet

A list of registered devices showing:
- Device name + id
- Status indicator (green dot = online, gray = offline)
- Type badge (e.g. "minion")
- Hardware summary (arch, cores, RAM)
- Last seen timestamp

Clicking a device opens the workspace panel filtered to that device.

**Data flow:** On sidebar mount → `ext-hive:list-devices`. Manual refresh button (no auto-polling).

### Workspace: Task Dispatch + History

Two sections in a single workspace tab:

**1. Dispatch Form (top)**
- Device selector dropdown (populated from `ext-hive:list-devices`, shows only online devices)
- Instruction type selector: `exec` | `read` | `write` | `http`
- Dynamic fields based on type:
  - `exec`: command (textarea), cwd (optional), timeout (optional)
  - `read`: path, encoding (optional)
  - `write`: path, content (textarea), mode (optional)
  - `http`: method, url, headers (JSON), body (textarea)
- Priority selector (default: normal)
- "Dispatch" button

**2. Task History (bottom)**
- Table: task ID (truncated), device, instruction type, status, created, duration
- Filterable by device (from sidebar click) and status
- Click a row → expand to show full instruction + result (stdout/stderr for exec, content for read, etc.)
- Loaded via `ext-hive:list-tasks` on mount, refresh button

Each workspace tab can target a different device (device selector is per-tab).

---

## Skills (AI Tool Integration)

Five skills registered with `SkillRegistry`, all with `category: 'utility'` and `aiTool: true`.

Each skill receives a `HiveClient` getter via constructor (`() => HiveClient`). Skills are created during `activate()` and registered with `context.services.skills`.

### `hive-exec`
- **Description:** Execute a shell command on a remote minion device
- **Input:** `{ device: string, command: string, cwd?: string, timeout?: number }`
- **Output:** `{ exitCode: number, stdout: string, stderr: string, durationMs: number }`
- **Behavior:** Creates task via HiveClient, polls until completed/failed/timeout (max 5 min, poll every 2s)

### `hive-read`
- **Description:** Read a file from a remote minion device
- **Input:** `{ device: string, path: string }`
- **Output:** `{ content: string }`

### `hive-write`
- **Description:** Write a file on a remote minion device
- **Input:** `{ device: string, path: string, content: string }`
- **Output:** `{ bytesWritten: number }`

### `hive-http`
- **Description:** Make an HTTP request from a remote minion device
- **Input:** `{ device: string, method: string, url: string, headers?: object, body?: string }`
- **Output:** `{ status: number, headers: object, body: string }`

**Polling strategy:** After dispatching, poll `getTask(id)` every 2 seconds until status is `completed`, `failed`, or `timeout`. Max poll duration = instruction timeout + 30s buffer, default 5 minutes.

**Device selection:** The AI must specify a `device` ID. It can call `ext-hive:list-devices` first (or use a `hive-list-devices` skill) to see what's available.

### `hive-list-devices`
- **Description:** List all registered minion devices and their status
- **Input:** `{}`
- **Output:** `{ devices: Array<{ id, name, status, type, arch, cores, ramMb }> }`

Five skills total. All block until the task completes (no streaming). The AI caller is blocked during polling — acceptable for now.

---

## File Structure

```
packages/extensions/ext-hive/
├── package.json
├── SPEC.md
└── src/
    ├── ipc-channels.ts              # Channel constants (shared)
    ├── main/
    │   ├── index.ts                 # activate/deactivate
    │   ├── hive-client.ts           # HiveClient REST wrapper
    │   ├── ipc-handlers.ts          # IPC handler registration
    │   ├── ipc-schemas.ts           # Zod schemas for IPC args
    │   └── skills/
    │       ├── hive-exec-skill.ts
    │       ├── hive-read-skill.ts
    │       ├── hive-write-skill.ts
    │       ├── hive-http-skill.ts
    │       └── hive-list-devices-skill.ts
    └── renderer/
        ├── index.ts                 # activate/deactivate (register views)
        ├── lib/
        │   └── ipc-client.ts        # Typed IPC invoke wrappers
        ├── store/
        │   └── index.ts             # Zustand store
        └── components/
            ├── HiveSidebar.tsx       # Device fleet list
            ├── HiveWorkspace.tsx     # Task dispatch + history
            ├── DeviceCard.tsx        # Single device row
            ├── DispatchForm.tsx      # Instruction form
            └── TaskHistory.tsx       # Task list + result viewer
```

No local DB, no migrations. All state on the hive.

---

## Error Handling

- **Hive unreachable:** Show banner in sidebar/workspace: "Hive offline — check settings". Skills return `{ success: false, error: "Hive unreachable" }`.
- **Invalid credentials:** 401/403 → "Invalid API key — check hive.api-key in settings"
- **Device offline:** Dispatch still works (task queued), but warn in UI: "Device is offline — task will be dispatched when it reconnects"
- **Task timeout:** Skill returns `{ success: false, error: "Task timed out after Ns" }`

---

## Constraints

- No local caching of device/task data — always fetch from hive
- No WebSocket connection to hive — REST polling only
- One hive-side change required: add `limit` query param to `GET /api/tasks`
- IPC channels must match `/^[a-z-]+:[a-z-]+$/`
