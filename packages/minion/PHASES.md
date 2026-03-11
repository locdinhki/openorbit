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
- [ ] Deploy hive to Railway (push + configure env vars)
- [ ] Deploy minion to Pi (run install.sh)

## Phase 4: File Transfer (R2)
- [ ] R2 bucket setup
- [ ] Upload handler in minion
- [ ] Download handler in minion
- [ ] Inline vs R2 threshold (1MB)

## Phase 5: Controller Extension (ext-hive)
- [ ] Package scaffold following OpenOrbit extension pattern
- [ ] Hive REST client
- [ ] IPC handlers
- [ ] Device fleet sidebar panel
- [ ] Manual task dispatch UI
- [ ] SkillRegistry integration (AI can use minions as tools)

## Phase 6: Dashboard
- [ ] Static HTML served by hive
- [ ] Device list page
- [ ] Task list + detail pages
- [ ] Manual dispatch form
