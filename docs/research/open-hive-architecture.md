# Open Hive + Minions Architecture

## Vision

A distributed compute network where low-spec IoT devices ("minions") execute tasks orchestrated by AI-powered controllers through a central relay ("hive"). The AI reasoning happens on capable devices or cloud services — minions are dumb workers that just follow instructions.

**Core insight:** File operations, shell commands, and HTTP requests are trivially cheap. Even a Raspberry Pi can execute them. The expensive part — AI reasoning, planning, decision-making — stays on controllers that can handle it.

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐
│   MacBook        │     │   iPad           │
│   (Controller)   │     │   (Controller)   │
│   Electron UI    │     │   App / PWA      │
│   AI: Local +    │     │   AI: Claude /   │
│   Claude/OpenAI  │     │   OpenAI         │
└────────┬─────────┘     └────────┬─────────┘
         │                        │
         │    REST API            │  REST API
         ▼                        ▼
┌─────────────────────────────────────────────┐
│              HIVE (Railway)                  │
│                                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│   │ REST API │  │ WS Server│  │ Web UI   │ │
│   │          │  │          │  │(Dashboard)│ │
│   └────┬─────┘  └────┬─────┘  └──────────┘ │
│        │              │                     │
│        ▼              ▼                     │
│   ┌────────────────────────┐                │
│   │   PostgreSQL (Railway) │                │
│   │   - device registry    │                │
│   │   - task queue         │                │
│   │   - results store      │                │
│   └────────────────────────┘                │
└──────────────────┬──────────────────────────┘
                   │
          WebSocket (outbound from minions)
                   │
      ┌────────────┼────────────────┐
      │            │                │
      ▼            ▼                ▼
┌──────────┐ ┌──────────┐   ┌──────────────┐
│  Pi 4    │ │ PC Win   │   │ Mac Mini x2  │
│ (Minion) │ │ (Minion) │   │  (Minions)   │
│ Home #1  │ │ Home #1  │   │  Home #2     │
└──────────┘ └──────────┘   └──────────────┘
```

---

## Components

### 1. Hive (Central Relay)

**What it is:** A lightweight Node.js server deployed on Railway. The single rendezvous point that all devices connect to.

**Responsibilities:**
- Device registry — track which minions are online, their capabilities, location tags
- Task queue — receive instructions from controllers, dispatch to minions
- Result storage — store execution results from minions
- Web dashboard — browser-based monitoring and manual control
- Auth — API keys per device, secure WebSocket connections

**What it is NOT:**
- Not an AI engine — zero inference happens here
- Not a heavy compute server — just message passing and light DB ops

**Tech stack:**
- Node.js + Express (REST API)
- `ws` library (WebSocket server)
- PostgreSQL (Railway managed addon)
- React or simple HTML dashboard (served from same deployment)
- Custom domain: `yourdomain.com` → Railway

**Hosted on:** Railway ($5/mo hobby plan)

### 2. Controller (AI Brain)

**What it is:** A capable device where the user interacts and AI reasoning happens.

**Types:**
| Controller | UI | AI | Use Case |
|---|---|---|---|
| MacBook (OpenOrbit) | Full Electron app | Local (LM Studio/Ollama) + Claude/OpenAI | Primary — full power workflows |
| Web Dashboard | Browser on any device | None (manual only) | Monitoring, quick manual tasks |
| iPad App | Native / PWA | Claude / OpenAI API | Mobile — on-the-go management |

**Responsibilities:**
- Compose high-level goals ("scrape these 50 listings and rank them")
- AI breaks goals into discrete instructions for minions
- Send instructions to hive via REST API
- Receive and display results
- Make decisions based on results (retry, escalate, chain next task)

**Integration with OpenOrbit:**
- New extension `ext-hive` that talks to the hive REST API
- Registers as a skill in SkillRegistry — AI can dispatch to minions as a tool
- Minion fleet appears as available "devices" in the UI

### 3. Minion (Dumb Worker)

**What it is:** A tiny Node.js agent running on any device with internet access. Stateless. No AI. Just executes instructions.

**Responsibilities:**
- Connect to hive via WebSocket on boot
- Authenticate and register capabilities
- Listen for instructions
- Execute instructions (file ops, shell commands, HTTP requests)
- Report results back to hive

**Boot sequence:**
```
1. Power on
2. Connect to available network (WiFi/Ethernet)
3. WebSocket connect to hive.yourdomain.com
4. Send: { type: "register", deviceId: "pi-home1", capabilities: [...] }
5. Wait for instructions
6. On disconnect → exponential backoff retry (5s, 10s, 30s, 60s)
7. On reconnect → "last instruction I processed was #47, what did I miss?"
```

**Target devices:**
- Raspberry Pi 4 / Pi Zero 2 W
- Old Windows PCs
- Mac Minis
- Any Linux box
- Potentially: cheap Android phones, NAS devices

**Deployment:** Single executable via `bun compile` or `pkg` — no Node.js install required on the device. Could also be a Docker container or a systemd service.

---

## Minion Installation

### Dashboard Flow (Primary)

1. Open the web dashboard at `hive.yourdomain.com`
2. Click **"Add Device"**
3. Fill in name, location tag, capabilities
4. Hive generates a device API key and a ready-to-paste install command
5. SSH into the target device, paste the one-liner, done

### One-Liner Install

The hive serves install scripts at namespaced endpoints:

```
https://hive.yourdomain.com/minion/install.sh       ← minion agent
https://hive.yourdomain.com/controller/install.sh   ← future: CLI controller
```

**Basic install (prompted):**
```bash
curl -fsSL https://hive.yourdomain.com/minion/install.sh | bash
```
Prompts for hive URL, API key, and device name interactively.

**Pre-configured install (generated by dashboard):**
```bash
curl -fsSL "https://hive.yourdomain.com/minion/install.sh?key=abc123&name=pi-kitchen&tags=home-1,raspberry-pi" | bash
```
Key and config baked into the URL — zero manual input needed on the device.

### What the Install Script Does

```bash
#!/bin/bash
# 1. Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')    # linux, darwin
ARCH=$(uname -m)                                 # x86_64, aarch64, armv7l

# 2. Download the right binary
BINARY_URL="https://hive.yourdomain.com/releases/minion-${OS}-${ARCH}"
curl -fsSL "$BINARY_URL" -o /usr/local/bin/hive-minion
chmod +x /usr/local/bin/hive-minion

# 3. Write config from URL params (or prompt)
cat > /etc/hive-minion/config.json <<EOF
{
  "hiveUrl": "wss://hive.yourdomain.com",
  "apiKey": "${API_KEY}",
  "deviceName": "${DEVICE_NAME}",
  "tags": ["${TAGS}"],
  "allowedOps": ["read", "write", "exec", "upload", "download", "http"],
  "workDir": "/home/pi/hive-workspace"
}
EOF

# 4. Install as system service (auto-start on boot)
# Linux (systemd)
cat > /etc/systemd/system/hive-minion.service <<EOF
[Unit]
Description=Hive Minion Agent
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/usr/local/bin/hive-minion
Restart=always
RestartSec=5
User=pi

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable hive-minion
systemctl start hive-minion

# macOS (launchd) — auto-detected for Mac Minis
# Windows — installed as a Windows Service via node-windows or NSSM
```

### Platform-Specific Notes

| Platform | Service Manager | Binary Format | Notes |
|---|---|---|---|
| Raspberry Pi OS | systemd | linux-arm64 / linux-armv7l | Most common minion target |
| Ubuntu / Debian | systemd | linux-x86_64 / linux-arm64 | Standard Linux box |
| macOS (Mac Mini) | launchd | darwin-x86_64 / darwin-arm64 | Uses plist instead of systemd |
| Windows | Windows Service (NSSM) | win-x64.exe | Needs separate install path |

### Post-Install Verification

After install, the minion immediately connects to the hive. You'll see it appear as **online** in the dashboard within seconds:

```
$ curl -fsSL "https://hive.yourdomain.com/minion/install.sh?key=abc123&name=pi-kitchen" | bash

  ✓ Detected platform: linux-arm64
  ✓ Downloaded hive-minion binary (4.2 MB)
  ✓ Config written to /etc/hive-minion/config.json
  ✓ Installed systemd service
  ✓ Started hive-minion service
  ✓ Connected to hive — device "pi-kitchen" is now online!
```

### Updating Minions

The hive can push updates to all minions via the existing instruction system:

```json
{
  "type": "exec",
  "command": "curl -fsSL https://hive.yourdomain.com/minion/install.sh?key=existing-key | bash"
}
```

Or a dedicated `update` instruction type that downloads the new binary and restarts the service in-place.

---

## Communication Protocol

### Controller → Hive (REST API)

```
POST /api/tasks
Authorization: Bearer <controller-api-key>

{
  "targetDevices": ["pi-home1", "mac-mini-1"],  // or "*" for all
  "priority": "normal",
  "instruction": {
    "type": "exec",
    "command": "df -h",
    "timeout": 30000
  }
}
```

```
GET /api/tasks/:taskId
GET /api/devices
GET /api/devices/:deviceId/status
GET /api/results?taskId=xxx
```

### Hive → Minion (WebSocket)

```json
// Hive sends instruction
{
  "messageId": "msg-001",
  "taskId": "task-abc",
  "instruction": {
    "type": "exec",
    "command": "df -h",
    "timeout": 30000
  }
}

// Minion sends result
{
  "messageId": "msg-001",
  "taskId": "task-abc",
  "status": "completed",
  "result": {
    "exitCode": 0,
    "stdout": "Filesystem  Size  Used ...",
    "stderr": "",
    "durationMs": 120
  }
}

// Minion heartbeat (every 30s)
{ "type": "heartbeat", "timestamp": 1710000000 }

// Hive heartbeat ack
{ "type": "heartbeat-ack", "pendingTasks": 0 }
```

---

## Instruction Types

### `read` — Read a file
```json
{
  "type": "read",
  "path": "/home/pi/data/sensor.log",
  "encoding": "utf-8",
  "maxBytes": 1048576
}
// Result: { "content": "..." }
```

### `write` — Write content to a file
```json
{
  "type": "write",
  "path": "/home/pi/scripts/task.sh",
  "content": "#!/bin/bash\necho hello",
  "mode": "0755"
}
// Result: { "bytesWritten": 28 }
```

### `exec` — Run a shell command
```json
{
  "type": "exec",
  "command": "python3 scrape.py --url https://example.com",
  "cwd": "/home/pi/scripts",
  "timeout": 60000,
  "env": { "API_KEY": "xxx" }
}
// Result: { "exitCode": 0, "stdout": "...", "stderr": "..." }
```

### `upload` — Minion uploads a file to object storage
```json
{
  "type": "upload",
  "localPath": "/home/pi/captures/screenshot.png",
  "remotePath": "captures/pi-home1/screenshot.png"
}
// Result: { "url": "https://r2.yourdomain.com/captures/pi-home1/screenshot.png" }
```

### `download` — Minion downloads a file from object storage
```json
{
  "type": "download",
  "url": "https://r2.yourdomain.com/scripts/scraper-v2.py",
  "localPath": "/home/pi/scripts/scraper-v2.py",
  "mode": "0755"
}
// Result: { "bytesDownloaded": 4096 }
```

### `http` — Make an HTTP request
```json
{
  "type": "http",
  "method": "GET",
  "url": "https://api.example.com/data",
  "headers": { "Authorization": "Bearer xxx" },
  "timeout": 10000
}
// Result: { "status": 200, "headers": {...}, "body": "..." }
```

---

## File Transfer Strategy

Files flow through different channels depending on size:

| Size | Channel | Example |
|---|---|---|
| < 1 MB | Inline via WebSocket/API | Config files, script output, JSON results |
| 1 MB - 1 GB | Object storage (Cloudflare R2) | Screenshots, logs, scraped data |
| > 1 GB | Direct transfer (future) | Database dumps, video files |

**Object storage:** Cloudflare R2 (free tier: 10GB storage, 10M reads/mo). Minions and controllers both have R2 credentials to upload/download directly — the hive just passes the URLs.

```
Controller                    R2                    Minion
    │                         │                       │
    │── upload script ──────→ │                       │
    │                         │                       │
    │── instruction ──────────────────────────────→   │
    │   {download: "r2://scripts/job.sh"}             │
    │                         │                       │
    │                         │ ←── download script ──│
    │                         │                       │
    │                         │        (executes)     │
    │                         │                       │
    │                         │ ←── upload result ────│
    │                         │                       │
    │   ←── result: {url: "r2://results/out.json"} ──│
    │                         │                       │
    │── download result ────→ │                       │
```

---

## Database Schema (PostgreSQL on Railway)

### `devices`
```sql
CREATE TABLE devices (
  id            TEXT PRIMARY KEY,           -- "minion-01-pi4" (friendly name, set by user)
  hardware_id   TEXT UNIQUE NOT NULL,       -- hardware fingerprint (see below), immutable
  api_key_hash  TEXT NOT NULL,              -- bcrypt hash of device API key
  name          TEXT NOT NULL,              -- "Raspberry Pi 4 - Living Room"
  type          TEXT NOT NULL,              -- "minion" | "controller"
  capabilities  JSONB DEFAULT '[]',         -- ["exec", "file", "http", "gpio"]
  location_tag  TEXT,                       -- "home-1", "home-2"
  status        TEXT DEFAULT 'offline',     -- "online" | "offline" | "busy"
  last_seen_at  TIMESTAMPTZ,
  ip_address    TEXT,                       -- updated on every reconnect
  hardware_info JSONB,                      -- full device-info.sh output, updated on reconnect
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- hardware_id is the permanent identity that survives network/location changes
-- Lookup: minion connects → sends hardware_id → hive matches to existing device → updates IP/status
```
```

### `tasks`
```sql
CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  created_by    TEXT REFERENCES devices(id), -- which controller created it
  target_device TEXT REFERENCES devices(id), -- null = broadcast
  priority      TEXT DEFAULT 'normal',       -- "low" | "normal" | "high" | "critical"
  status        TEXT DEFAULT 'queued',       -- "queued" | "dispatched" | "running" | "completed" | "failed" | "timeout"
  instruction   JSONB NOT NULL,              -- the instruction payload
  dispatched_at TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### `task_results`
```sql
CREATE TABLE task_results (
  id            TEXT PRIMARY KEY,
  task_id       TEXT REFERENCES tasks(id),
  device_id     TEXT REFERENCES devices(id),
  status        TEXT NOT NULL,               -- "success" | "error" | "timeout"
  result        JSONB,                       -- the result payload
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### `task_chains` (for multi-step workflows)
```sql
CREATE TABLE task_chains (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  created_by    TEXT REFERENCES devices(id),
  steps         JSONB NOT NULL,              -- ordered array of instruction templates
  status        TEXT DEFAULT 'pending',
  current_step  INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Device Identity & Hardware Fingerprint

Each minion has a **hardware fingerprint** — a unique identifier burned into the hardware that never changes, regardless of network, location, IP, or OS reinstall. This is how the hive recognizes a device across moves.

### Fingerprint Sources by Platform

| Platform | Primary ID | Source | Survives OS Reinstall |
|---|---|---|---|
| Raspberry Pi | SoC Serial | `/proc/cpuinfo` → `Serial` | Yes (fused in chip) |
| Linux (generic) | Machine ID | `/etc/machine-id` | No (regenerated) |
| Linux (generic) | DMI Product UUID | `/sys/class/dmi/id/product_uuid` | Yes (in firmware) |
| macOS | Hardware UUID | `system_profiler SPHardwareDataType` → `Hardware UUID` | Yes (in firmware) |
| Windows | Machine GUID | `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` | No (regenerated) |
| All | MAC Address | Primary network interface | Yes (unless adapter swapped) |

### Fingerprint Generation

The minion agent computes a composite `hardware_id` on first boot:

```
hardware_id = sha256(pi_serial || mac_address || machine_uuid)
```

**Priority order:**
1. Pi Serial (if Raspberry Pi) — most reliable, globally unique
2. DMI Product UUID / macOS Hardware UUID — firmware-level, very stable
3. MAC address — fallback, stable unless NIC is replaced
4. `/etc/machine-id` — last resort (Linux), less stable across reinstalls

The `hardware_id` is stored locally in the minion config and sent on every connection. The hive uses it to match the device to its record, then updates the mutable fields (IP, hostname, etc.).

### Reconnection Flow

```
Minion plugged in at new location (coffee shop WiFi)
  → Boots, gets new IP: 10.0.0.45
  → Reads local config: hardware_id = "a1b2c3..."
  → Connects WS to hive: { apiKey: "xxx", hardwareId: "a1b2c3..." }
  → Hive looks up hardware_id in devices table
  → Found: minion-01-pi4
  → Updates: ip_address = "10.0.0.45", status = "online", last_seen_at = now()
  → Sends queued tasks that accumulated while offline
  → Dashboard shows: "minion-01-pi4 reconnected from 10.0.0.45"
```

### What Changes vs What Stays

| Field | Changes on move? | Stored where |
|---|---|---|
| `hardware_id` | Never | Hive DB + local config |
| `api_key` | Never (unless rotated) | Hive DB + local config |
| `id` (friendly name) | Never (unless renamed) | Hive DB + local config |
| `ip_address` | Yes | Hive DB (updated on reconnect) |
| `mac_address` | No (unless WiFi→Ethernet) | Hive DB (updated on reconnect) |
| `location_tag` | Optional (manual update) | Hive DB |
| `hostname` | No (unless changed) | Hive DB (updated on reconnect) |

---

## Security Model

### Authentication
- Each device gets a unique API key on registration
- Controllers use Bearer token auth for REST API
- Minions authenticate on WebSocket connect with their API key + hardware fingerprint
- API keys stored hashed (bcrypt) in the `devices` table
- Hardware fingerprint provides secondary identity verification

### Instruction Safety
- Minions have a configurable **allowlist** of permitted instruction types
- `exec` commands can be restricted to specific directories or command prefixes
- File operations restricted to designated working directories
- Environment variables with secrets are encrypted in transit, never logged

### Network
- All connections over TLS (Railway provides HTTPS + WSS)
- Minions only make outbound connections — no inbound ports exposed
- Rate limiting on the hive API to prevent abuse

---

## Web Dashboard

A lightweight browser UI served by the hive for monitoring and manual control.

### Pages
- **Devices** — list all minions/controllers, online status, last seen, capabilities
- **Tasks** — task queue with filters (status, device, time range)
- **Task Detail** — instruction, result, duration, logs
- **Live View** — real-time WebSocket feed of task executions
- **Manual Dispatch** — form to send instructions to specific minions

### No AI on the dashboard
The web dashboard is purely for monitoring and manual dispatch. AI-powered workflows always originate from a full controller (MacBook/iPad).

---

## Project Structure

```
packages/
  hive/                          ← Railway deployment
    src/
      server/
        index.ts                 ← Express + WS server entry
        routes/
          devices.ts             ← GET/POST /api/devices
          tasks.ts               ← GET/POST /api/tasks
          results.ts             ← GET /api/results
        ws/
          connection-manager.ts  ← WebSocket lifecycle, heartbeats
          dispatcher.ts          ← Route tasks to connected minions
        db/
          schema.ts              ← Drizzle/Prisma schema
          migrations/            ← DB migrations
        auth/
          middleware.ts          ← API key validation
      web/                       ← Dashboard frontend
        index.html
        app.tsx
        pages/
          devices.tsx
          tasks.tsx
          live-view.tsx
    package.json
    Dockerfile                   ← Railway deployment config

  minion/                        ← Runs on Pi / PC / Mac Mini
    src/
      index.ts                   ← Entry point
      connection.ts              ← WebSocket client + reconnect logic
      executor.ts                ← Instruction execution engine
      handlers/
        read.ts                  ← File read handler
        write.ts                 ← File write handler
        exec.ts                  ← Shell exec handler
        upload.ts                ← R2 upload handler
        download.ts              ← R2 download handler
        http.ts                  ← HTTP request handler
      config.ts                  ← Device ID, hive URL, allowed ops
    package.json

  extensions/
    ext-hive/                    ← OpenOrbit extension (controller side)
      src/
        main/
          hive-client.ts         ← REST API client for hive
          index.ts               ← Extension entry, IPC handlers
        renderer/
          hive-panel.tsx         ← Device fleet overview in OpenOrbit UI
          task-composer.tsx       ← AI-assisted task creation
      package.json
```

---

## Development Phases

### Phase 1: Hive MVP
- [ ] Railway project setup + Postgres
- [ ] Domain purchase + DNS pointing to Railway
- [ ] Express server with device registration API
- [ ] WebSocket server with heartbeat
- [ ] Task queue (create, dispatch, complete)
- [ ] Basic web dashboard (device list + task list)

### Phase 2: Minion Agent
- [ ] WebSocket client with auto-reconnect
- [ ] `exec` handler (shell commands)
- [ ] `read` / `write` handlers (file operations)
- [ ] `http` handler (HTTP requests)
- [ ] Device registration on connect
- [ ] Config file for device ID, hive URL, permissions
- [ ] Test on Raspberry Pi

### Phase 3: Controller Integration
- [ ] `ext-hive` extension for OpenOrbit
- [ ] Hive API client
- [ ] Device fleet panel in UI
- [ ] Manual task dispatch from OpenOrbit
- [ ] AI-powered task composition (describe goal → AI generates instructions)

### Phase 4: File Transfer
- [ ] Cloudflare R2 bucket setup
- [ ] `upload` / `download` handlers in minion
- [ ] Inline payload for small files (< 1MB via WS)
- [ ] R2 presigned URLs for large files

### Phase 5: Advanced Features
- [ ] Task chains (multi-step workflows)
- [ ] Task scheduling (cron-like recurring tasks)
- [ ] Device groups and broadcast targeting
- [ ] iPad PWA controller
- [ ] Minion auto-update mechanism
- [ ] Encrypted secret delivery to minions

---

## Example Workflows

### 1. "Check disk space on all devices"
```
Controller → Hive: POST /tasks { target: "*", instruction: { type: "exec", command: "df -h" } }
Hive → Minion-1: WS { exec: "df -h" }
Hive → Minion-2: WS { exec: "df -h" }
Hive → Minion-3: WS { exec: "df -h" }
Minion-1 → Hive: WS { result: "..." }
Minion-2 → Hive: WS { result: "..." }
Minion-3 → Hive: WS { result: "..." }
Controller ← Hive: GET /results?taskId=xxx → aggregated results
```

### 2. "Deploy a script to all Pi devices and run it"
```
Controller → R2: upload scraper.py
Controller → Hive: POST /task-chain {
  steps: [
    { target: "pi-*", type: "download", url: "r2://scripts/scraper.py", localPath: "/home/pi/scraper.py" },
    { target: "pi-*", type: "exec", command: "python3 /home/pi/scraper.py" },
    { target: "pi-*", type: "upload", localPath: "/home/pi/output.json", remotePath: "results/" }
  ]
}
```

### 3. AI-powered: "Scrape Zillow for these 10 addresses from different IPs"
```
User tells OpenOrbit: "Scrape these 10 addresses on Zillow"
AI reasons: "I have 4 minions on different networks. Split 10 addresses across them to avoid rate limits."
AI generates 4 task chains, one per minion, 2-3 addresses each
Results flow back → AI aggregates and analyzes → presents to user
```

---

## Self-Healing & On-Demand Provisioning

Minions start as bare OS installs. Instead of pre-installing everything, the hive and AI controller **detect failures and fix them on the fly**. The minion just reports errors honestly — the brain decides how to resolve them.

### Error → Diagnose → Fix → Retry Loop

```
Controller: "Run scrape.py on minion-01-pi4"

  ┌─ Attempt 1 ────────────────────────────────────────────────┐
  │ Hive → Minion: { exec: "python3 scrape.py" }              │
  │ Minion → Hive: { exitCode: 127, stderr: "python3: not found" }
  └────────────────────────────────────────────────────────────┘
       │
       ▼ AI/Hive parses stderr → missing runtime
  ┌─ Auto-fix ─────────────────────────────────────────────────┐
  │ Hive → Minion: { exec: "sudo apt install -y python3 python3-pip" }
  │ Minion → Hive: { exitCode: 0 }                            │
  └────────────────────────────────────────────────────────────┘
       │
       ▼ Retry original task
  ┌─ Attempt 2 ────────────────────────────────────────────────┐
  │ Hive → Minion: { exec: "python3 scrape.py" }              │
  │ Minion → Hive: { exitCode: 1, stderr: "No module 'requests'" }
  └────────────────────────────────────────────────────────────┘
       │
       ▼ AI/Hive parses stderr → missing pip package
  ┌─ Auto-fix ─────────────────────────────────────────────────┐
  │ Hive → Minion: { exec: "pip3 install requests" }          │
  │ Minion → Hive: { exitCode: 0 }                            │
  └────────────────────────────────────────────────────────────┘
       │
       ▼ Retry original task
  ┌─ Attempt 3 ────────────────────────────────────────────────┐
  │ Hive → Minion: { exec: "python3 scrape.py" }              │
  │ Minion → Hive: { exitCode: 0, stdout: "scraped 50 results" }
  └────────────────────────────────────────────────────────────┘
       │
       ▼ Success — update device capabilities
```

### Common Error Patterns the AI Can Resolve

| stderr pattern | Diagnosis | Auto-fix command |
|---|---|---|
| `command not found: python3` | Missing runtime | `sudo apt install -y python3` |
| `command not found: node` | Missing runtime | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo bash - && sudo apt install -y nodejs` |
| `No module named 'xxx'` | Missing Python package | `pip3 install xxx` |
| `Cannot find module 'xxx'` | Missing Node package | `npm install xxx` |
| `permission denied` | Need elevated privileges | Re-run with `sudo` |
| `No space left on device` | Disk full | `sudo apt clean && sudo journalctl --vacuum-size=50M` |
| `docker: not found` | Docker not installed | `curl -fsSL https://get.docker.com \| sh` |
| `E: Unable to locate package` | Stale apt cache | `sudo apt update` then retry |

### Dynamic Capabilities

After the AI successfully installs something, the hive updates the device's `capabilities` and `hardware_info`:

```sql
-- After installing python3 on minion-01-pi4
UPDATE devices
SET capabilities = capabilities || '["python3"]',
    hardware_info = jsonb_set(hardware_info, '{software,python}', '"3.9.2"')
WHERE id = 'minion-01-pi4';
```

The AI controller uses capabilities for **smart task routing**:
- "This task needs Python → which minions have Python? → route to those"
- "No minions have Python → pick the one with most free disk → install Python → then run"
- "This needs Docker → minion-01-pi4 has Docker → send there"

### Provisioning Recipes

For common setups, the hive can store reusable **provisioning recipes** — task chains that bootstrap a bare minion into a specific role:

```json
{
  "name": "web-scraper-setup",
  "description": "Prepares a minion for web scraping tasks",
  "steps": [
    { "exec": "sudo apt update && sudo apt upgrade -y" },
    { "exec": "sudo apt install -y python3 python3-pip chromium-browser" },
    { "exec": "pip3 install requests beautifulsoup4 selenium playwright" },
    { "exec": "playwright install chromium" },
    { "exec": "mkdir -p /home/pi/hive-workspace/scraper" }
  ]
}
```

```json
{
  "name": "docker-host-setup",
  "description": "Prepares a minion to run Docker containers",
  "steps": [
    { "exec": "curl -fsSL https://get.docker.com | sh" },
    { "exec": "sudo usermod -aG docker pi" },
    { "exec": "sudo systemctl enable docker" },
    { "exec": "docker pull alpine:latest" }
  ]
}
```

Apply a recipe from the dashboard or controller:
```
POST /api/tasks
{ "targetDevice": "minion-01-pi4", "recipe": "web-scraper-setup" }
```

### Max Retry & Escalation

The auto-fix loop has safety limits:
- **Max 3 auto-fix attempts** per task — prevents infinite loops
- **Escalate to controller** if auto-fix fails — "minion-01-pi4 can't run scrape.py after 3 fix attempts, here's what I tried"
- **Never auto-fix destructive commands** — `rm`, `format`, `dd` are never auto-generated
- **Log all auto-fixes** — every install/fix command is stored in `task_results` for audit

### Minion Execution Architecture

The minion binary is the **connection + execution layer**. It does NOT interpret scripts — it delegates to the OS:

```
┌──────────────────────────────────────────────────┐
│ Minion Binary (compiled, ~5MB)                   │
│                                                  │
│  WebSocket Client ──→ Instruction Router         │
│                        │                         │
│                   ┌────┴────┐                    │
│                   │ exec    │──→ bash -c "..."   │
│                   │ read    │──→ fs.readFile()   │
│                   │ write   │──→ fs.writeFile()  │
│                   │ upload  │──→ HTTP PUT to R2  │
│                   │ download│──→ HTTP GET from R2│
│                   │ http    │──→ fetch()         │
│                   └─────────┘                    │
└──────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────┐
│ OS Layer (whatever is installed on the device)   │
│                                                  │
│  bash, python3, node, docker, curl, apt, etc.    │
│  (installed on demand by the hive when needed)   │
└──────────────────────────────────────────────────┘
```

The minion binary never changes. The OS layer grows as needed. A fresh Pi with just Raspbian Lite + the minion binary is a fully capable worker — it just needs to be taught what tools to install for each task.

---

## Device Fleet

### Naming Convention

```
minion-{number}-{model}
```

Examples: `minion-01-pi4`, `minion-02-pi4`, `minion-03-pizero`, `minion-04-macmini`

### Current Fleet

| Device ID | Model | Arch | RAM | Storage | OS | IP (current) | Location | Status |
|---|---|---|---|---|---|---|---|---|
| `minion-01-pi4` | Raspberry Pi 4 Model B Rev 1.2 | aarch64 (arm64) | 4 GB | 238 GB SSD (USB) | Debian 11 (Bullseye) | 192.168.1.88 (wlan0) | Home | Active |

### minion-01-pi4 — Detailed Specs

```
Hostname:    minion-01-pi4
SoC:         BCM2835 (4 cores)
RAM:         3.7 GB total, ~3.2 GB available
Storage:     238.5 GB USB SSD (/dev/sda)
  /boot:     256 MB
  /root:     238.2 GB (217 GB free)
OS:          Debian GNU/Linux 11 (Bullseye)
Kernel:      6.1.21-v8+ aarch64
Network:     WiFi (wlan0) — 192.168.1.88/24
Docker:      Installed (docker0: 172.17.0.1/16)
Python:      3.9.2
Node.js:     Not installed (will be installed by minion agent or use compiled binary)
Serial:      100000003d6b74d8
Revision:    c03112
```

### Minion Prerequisites

Before the one-liner install works, the target device needs:

#### Raspberry Pi (first-time setup)
1. **Flash OS** — Use Raspberry Pi Imager to flash Raspberry Pi OS (Lite recommended)
2. **Enable SSH** — either via `raspi-config` on a connected monitor, or create empty `ssh` file on boot partition
3. **Connect to network** — WiFi or Ethernet
4. **Set password** — `sudo passwd pi` (change from default for security)
5. **Copy SSH key from controller** — for passwordless access:
   ```bash
   # On your MacBook (one-time per minion)
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ""  # skip if key exists
   ssh-copy-id pi@<minion-ip>
   ```
6. **Find the Pi on your network:**
   ```bash
   # Look for Raspberry Pi MAC prefixes (dc:a6:32, b8:27:eb, e4:5f:01)
   arp -a | grep -i "b8:27:eb\|dc:a6:32\|e4:5f:01"
   # Or try mDNS
   ping raspberrypi.local
   ```
7. **Rename hostname:**
   ```bash
   ssh pi@<minion-ip> "sudo hostnamectl set-hostname minion-XX-pi4"
   ```

#### Other Linux Devices
1. Enable SSH (`sudo systemctl enable ssh`)
2. Connect to network
3. Copy SSH key from controller

#### Mac Mini
1. Enable Remote Login in System Preferences → Sharing
2. Copy SSH key from controller

#### Windows PC
1. Install OpenSSH Server (Settings → Apps → Optional Features)
2. Or: install Node.js and run the minion agent directly

### Adding a New Minion (Quick Reference)

```bash
# 1. Find the device
arp -a | grep -i "b8:27:eb\|dc:a6:32\|e4:5f:01"

# 2. Copy SSH key (enter device password when prompted)
ssh-copy-id pi@<ip>

# 3. Rename it
ssh pi@<ip> "sudo hostnamectl set-hostname minion-XX-pi4"

# 4. Install minion agent (once hive is built)
ssh pi@<ip> "curl -fsSL https://hive.yourdomain.com/minion/install.sh?key=<key>&name=minion-XX-pi4 | bash"
```

---

## Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| DB location | Hive (Railway Postgres) | Single source of truth, always available, easy to iterate during dev |
| Minion connection | WebSocket (outbound) | Works through NAT/firewalls, real-time, minions phone home |
| AI location | Controller only | Minions stay cheap and simple, AI costs stay controllable |
| File transfer | Inline (small) + R2 (large) | Keeps hive lightweight, R2 free tier is generous |
| Hive hosting | Railway | Git deploy, managed Postgres, custom domains, cheap |
| Minion packaging | Single binary (bun compile) | Zero dependencies on target device |
| Auth | API keys per device | Simple, good enough for personal infrastructure |
