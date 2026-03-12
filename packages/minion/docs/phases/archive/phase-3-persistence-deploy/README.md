# Phase 3: Persistence + Deploy

**Theme:** Replace in-memory stores with PostgreSQL, deploy to Railway, and install minion on Pi as a systemd service.

**Effort:** Moderate | **Depends on:** Phase 2 | **Status:** Complete

## Why This Phase

In-memory state is lost on every hive restart. Devices need permanent records, tasks need durable history, and the hive needs to run reliably on Railway. This phase hardens the data layer and gets the real infrastructure running.

## Tasks

- [x] Railway project setup + PostgreSQL provisioned
- [x] PostgreSQL schema (Drizzle ORM) — `devices`, `tasks`, `task_results` tables
- [x] Migrate in-memory stores to DB (DeviceStore, TaskStore → Drizzle queries)
- [x] Device registration flow: `POST /api/devices` → returns plaintext API key, stores bcrypt hash
- [x] Heartbeat + offline detection (90s timeout → mark device offline)
- [x] API key hashing (bcrypt) on registration
- [x] All devices marked offline on hive startup (clean slate)
- [x] End-to-end test passing with PostgreSQL
- [x] Dockerfile + `npm run build` script for Railway deployment
- [x] Compiled JS verified (`node dist/index.js` runs cleanly)
- [x] Minion install script (`install.sh`) with systemd service unit
- [x] Deploy hive to Railway → `hive.openorbit.ai`
- [x] End-to-end verified: REST → Railway hive → WSS → local/Pi minion → result
- [x] Deploy minion to Pi (run `install.sh`)

## Database Schema

```sql
-- devices: registered minion agents
devices (id, hardware_id UNIQUE, api_key_hash, name, type, capabilities JSONB,
         location_tag, status, last_seen_at, ip_address, hardware_info JSONB,
         created_at, updated_at)

-- tasks: dispatched work units
tasks (id, created_by, target_device, priority, status, instruction JSONB,
       dispatched_at, completed_at, created_at)

-- task_results: execution output
task_results (id, task_id, device_id, status, result JSONB, duration_ms, created_at)
```

## Key Files

| File | Role |
|------|------|
| `packages/hive/src/db/schema.ts` | Drizzle table definitions |
| `packages/hive/src/db/migrate.ts` | Migration runner |
| `packages/hive/src/store.ts` | All DB queries |
| `packages/hive/Dockerfile` | Railway container |
| `packages/minion/install.sh` | Pi systemd install script |

## Success Criteria

- [x] Devices persist across hive restarts
- [x] Task history survives restarts
- [x] All devices go offline on hive startup (clean slate)
- [x] bcrypt API key verification works on reconnect
- [x] Hive runs on Railway at `hive.openorbit.ai`
- [x] Pi minion runs as systemd service, auto-starts on boot
- [x] End-to-end: OpenOrbit REST → Railway → Pi → result in <5s on LAN
