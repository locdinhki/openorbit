# Phase 17: Source-Level Self-Update

**Theme:** Minion pulls its own source code from the Hive server, replaces local files, and restarts — enabling one-click remote deploys without SSH.

**Effort:** Low | **Depends on:** Phase 12 (auto-update scaffolding) | **Status:** Not started

## Why This Phase

Phase 12 built self-update for **compiled binaries** (download binary → SHA256 verify → replace → restart). But our minions run as **TypeScript source via tsx**, not compiled binaries. The existing `self-update` handler downloads a binary that doesn't exist. We need a source-aware update path: the Hive serves a tarball of the minion source, and minions pull + extract + restart.

The immediate trigger: patching `connection.ts` on the Pi required SSH. With 5+ devices this doesn't scale.

## Problem

1. Minion source only exists in the repo and on each device — no sync mechanism
2. Phase 12's `self-update` handler expects a compiled binary at a URL with SHA256 checksum — doesn't work for tsx-based source installs
3. The Pi's minion source is already out of date (missing `self-update.ts` handler, missing dead-socket detection patch)

## Approach

### 1. Hive serves minion source bundle

**New endpoint:** `GET /minion/source-bundle`

- Reads `packages/minion/src/` from disk (or a configured path)
- Creates a `.tar.gz` on the fly containing the `src/` directory + `package.json` + `tsconfig.json`
- Includes a `X-Bundle-Hash` response header (SHA256 of the tarball)
- Requires device auth (API key in `Authorization` header) — same auth minions already use for WS

Why not reuse `/minion/latest`? That endpoint returns metadata (version, URL, checksum) for a pre-hosted binary. This is different — the Hive **is** the source of truth and serves the files directly.

### 2. New instruction type: `source-update`

Separate from `self-update` (binary) to avoid breaking the existing flow.

```typescript
interface SourceUpdateInstruction {
  type: 'source-update'
  bundleUrl: string    // e.g. "https://hive.openorbit.ai/minion/source-bundle"
  checksum?: string    // optional SHA256 — if omitted, trust the X-Bundle-Hash header
}
```

### 3. Minion handler: `handlers/source-update.ts`

1. `GET {bundleUrl}` with device API key in header
2. Save to temp file, verify SHA256 if provided
3. Extract tarball to temp directory
4. Swap:
   ```
   mv /opt/hive-minion/src /opt/hive-minion/src.bak
   mv /tmp/source-update-{ts}/src /opt/hive-minion/src
   cp /tmp/source-update-{ts}/package.json /opt/hive-minion/package.json
   ```
5. Run `npm install --production` if `package.json` changed
6. `systemctl restart hive-minion`
7. If restart fails within 10s, rollback: `mv /opt/hive-minion/src.bak /opt/hive-minion/src`

Always allowed (bypasses `allowedOps` whitelist, same as `self-update`).

### 4. Server dispatch routes

| Route | Behavior |
|-------|----------|
| `POST /api/minion/source-update/:deviceId` | Dispatch `source-update` task to one device |
| `POST /api/minion/source-update-all` | Dispatch to all online minions |

Both construct the instruction with `bundleUrl` pointing to the Hive's own `/minion/source-bundle` endpoint.

### 5. Dashboard UI

Add to the Devices page header (next to existing "Update All" button):
- **"Deploy Source"** button — calls `POST /api/minion/source-update-all`
- Per-device dropdown: "Deploy Source" option

### 6. Dead-socket detection (bundle with this phase)

Since the Pi is already out of date, the first source-update deploy will include the `connection.ts` heartbeat-ack + ping/pong fix from this session. After Phase 17, this kind of patch is a one-click deploy.

## Tasks

- [ ] `packages/hive/src/routes.ts` — add `GET /minion/source-bundle` (tar.gz of `packages/minion/`)
- [ ] `packages/hive/src/routes.ts` — add `POST /api/minion/source-update/:deviceId` and `/source-update-all`
- [ ] `packages/minion/src/types.ts` — add `SourceUpdateInstruction` + `SourceUpdateResult`
- [ ] `packages/minion/src/handlers/source-update.ts` — download, verify, extract, swap, npm install, restart, rollback
- [ ] `packages/minion/src/executor.ts` — add `case 'source-update'` (always allowed)
- [ ] `packages/minion/src/connection.ts` — include dead-socket detection (heartbeat-ack timeout + ping/pong)
- [ ] Dashboard: "Deploy Source" button on Devices page
- [ ] Dashboard API client: add `sourceUpdate` and `sourceUpdateAll` methods
- [ ] Bootstrap: deploy Phase 17 to Pi via SSH one last time, then all future updates go through Hive

## Flow

```
Dashboard "Deploy Source" button
    │
    ▼
POST /api/minion/source-update-all
    │
    ▼
Hive dispatches { type: 'source-update', bundleUrl } to each online minion
    │
    ▼
Minion receives task via WebSocket
    │
    ▼
GET /minion/source-bundle (downloads tarball from Hive)
    │
    ├─ Checksum mismatch? → return error, no changes
    │
    ├─ Checksum OK → extract to temp dir
    │
    ▼
Swap src/ + package.json, npm install if needed
    │
    ▼
systemctl restart hive-minion
    │
    ├─ Restart fails? → rollback src.bak → src
    │
    └─ Restart OK → minion reconnects with new code
         │
         ▼
    Hive marks device online, task completed
```

## Success Criteria

- [ ] `GET /minion/source-bundle` returns valid tarball of current minion source
- [ ] "Deploy Source" from dashboard updates a minion's source code and restarts it
- [ ] Minion reconnects automatically after source update
- [ ] Failed update rolls back to previous source
- [ ] After Phase 17 bootstrap, no more SSH needed for code deploys
