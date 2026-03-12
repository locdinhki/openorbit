# Phase 5: Controller Extension (ext-hive)

**Theme:** OpenOrbit extension that wraps the hive REST API — device fleet sidebar, manual task dispatch, and SkillRegistry integration so the AI can use minions as tools.

**Effort:** Moderate | **Depends on:** Phase 3 | **Status:** Complete

## Why This Phase

The hive API works, but interacting with it requires raw curl. There's no way to see device status, dispatch tasks, or view results from within OpenOrbit. The AI also can't use minions as tools. This phase bridges the gap.

## Tasks

- [x] Package scaffold following the OpenOrbit extension pattern
- [x] `HiveClient` — typed REST wrapper for all hive API endpoints
- [x] IPC handlers (6 channels): list devices, get device, dispatch task, get task, list tasks, health
- [x] Device fleet sidebar panel (`HiveSidebar.tsx`) — online/offline badges, hardware summary, last seen
- [x] Manual task dispatch workspace (`HiveWorkspace.tsx`) — device selector, instruction form, task history table
- [x] SkillRegistry integration — 5 skills: `hive-exec`, `hive-read`, `hive-write`, `hive-http`, `hive-list-devices`
- [x] Shell registration (preloadedModules + vite aliases)
- [x] Build verified (main 958kB, renderer 1357kB)

## IPC Channels

| Channel | Purpose |
|---------|---------|
| `ext-hive:list-devices` | Fetch all devices |
| `ext-hive:get-device` | Single device detail |
| `ext-hive:dispatch-task` | Create + dispatch task |
| `ext-hive:get-task` | Task detail + results |
| `ext-hive:list-tasks` | Filtered task list |
| `ext-hive:health` | Hive health check |

## Skills

| Skill | AI Tool | What It Does |
|-------|---------|-------------|
| `hive-list-devices` | Yes | List all devices with status |
| `hive-exec` | Yes | Run shell command on a device |
| `hive-read` | Yes | Read file from a device |
| `hive-write` | Yes | Write file to a device |
| `hive-http` | Yes | Make HTTP request from a device |

All skills poll `getTask()` every 2s until completed/failed/timeout (max 5 minutes).

## Key Files

| File | Role |
|------|------|
| `packages/extensions/ext-hive/src/main/hive-client.ts` | REST client |
| `packages/extensions/ext-hive/src/main/ipc-handlers.ts` | IPC registration |
| `packages/extensions/ext-hive/src/renderer/HiveSidebar.tsx` | Fleet panel |
| `packages/extensions/ext-hive/src/renderer/HiveWorkspace.tsx` | Task dispatch UI |

## Success Criteria

- [x] Device fleet visible in OpenOrbit sidebar with live status badges
- [x] Task dispatch form sends instructions and shows results inline
- [x] AI can call `hive-exec` to run commands on a specific device
- [x] Skills block until task completes (no fire-and-forget)
- [x] HiveClient recreates when settings (`hive.url`, `hive.api-key`) change
- [x] Build succeeds with no new bundle size regressions
