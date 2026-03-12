# Phase 12: Minion Auto-Update

**Theme:** Version tracking per device, self-update instruction that downloads + SHA256-verifies + replaces the binary, and a dashboard Update All flow.

**Effort:** Low | **Depends on:** Phase 6 | **Status:** Complete

## Why This Phase

Deploying a new minion binary requires SSH-ing into every device and running the install script manually. With 5+ devices this doesn't scale. The hive should be able to push an update to all online minions in one click.

## Tasks

- [x] `packages/minion/src/version.ts` — `MINION_VERSION` constant embedded in binary, reported in auth + heartbeat
- [x] Hive tracks per-device version in `devices.minion_version` column (V6 migration)
- [x] Latest version configured via env vars: `MINION_LATEST_VERSION`, `MINION_DOWNLOAD_URL`, `MINION_CHECKSUM`
- [x] `GET /minion/latest` → `{ version, downloadUrl, checksum }` (public, no auth required)
- [x] `POST /api/minion/update/:deviceId` — dispatches a `self-update` task to one device
- [x] `POST /api/minion/update-all` — dispatches to all online outdated devices, returns `{ deviceCount, tasks }`
- [x] Minion `self-update` instruction handler (`handlers/self-update.ts`):
  1. Download binary via `fetch()` to temp file
  2. SHA256 verify against `checksum` field (`sha256:<hex>` or bare hex)
  3. `chmodSync(tempPath, 0o755)`
  4. After 2s delay (so result is sent back first): `copyFileSync(temp, binaryPath)`
  5. Try `systemctl restart hive-minion`; on failure, spawn new process + `process.exit(0)`
- [x] `self-update` is always allowed — bypasses `allowedOps` whitelist
- [x] Dashboard Devices page: version column (amber + arrow if outdated), per-device Update button (online + outdated only), "Update All (N)" button in header
- [x] AI agent tools: `check_minion_versions`, `update_minion` (22 total tools)

## Self-Update Flow

```
Hive dispatches self-update task
    │
    ▼
Minion downloads new binary to /tmp/hive-minion-update-{ts}
    │
    ├─ SHA256 mismatch? → delete temp file, return error
    │
    ├─ SHA256 match? → chmod 0o755
    │
    ▼
Return { updated: true, message: "..." } to hive
    │ (2s delay)
    ▼
copyFileSync(temp → /usr/local/bin/hive-minion)
    │
    ├─ systemctl restart hive-minion (if running under systemd)
    └─ spawn new process + process.exit(0) (fallback)
```

## AI Tools (2 new, 22 total)

| Tool | Description |
|------|-------------|
| `check_minion_versions` | Compare all device versions against latest |
| `update_minion` | Push update to one device (by ID) or all outdated devices |

## Success Criteria

- [x] Minion version visible in dashboard Devices table
- [x] Outdated minions highlighted in amber with target version shown
- [x] Update All button dispatches to all online outdated minions in one click
- [x] Self-update verifies checksum before replacing binary
- [x] Minion restarts automatically after binary replacement
- [x] Update result is returned to hive before the process exits
