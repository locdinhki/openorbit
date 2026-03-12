# Phase 1: Minion Agent

**Theme:** Validate on real hardware — binary agent that executes instructions locally before any network is involved.

**Effort:** Low | **Status:** Complete

## Why This Phase

Before building any network infrastructure, verify that the core execution engine works on a Raspberry Pi. A single compiled binary should be able to run shell commands, read/write files, and make HTTP requests — all driven by a JSON instruction file. No hive, no WebSocket, no cloud.

## Tasks

- [x] Package scaffold (`package.json`, `tsconfig`, `src/`)
- [x] Instruction executor with handlers: `exec`, `read`, `write`, `http`
- [x] Hardware fingerprint generation (JS port of `device-info.sh`)
- [x] Config loader from `/etc/hive-minion/config.json`
- [x] Local API server (direct LAN access on port 18791)
- [x] Local test: run instructions from a JSON file, no network
- [x] `bun build --compile` → single binary (~5MB)
- [x] Deploy to Pi, run manually, verify exec/read/write work

## Key Files

| File | Role |
|------|------|
| `packages/minion/src/executor.ts` | Instruction dispatcher |
| `packages/minion/src/handlers/exec.ts` | Shell command execution |
| `packages/minion/src/handlers/read.ts` | File read |
| `packages/minion/src/handlers/write.ts` | File write |
| `packages/minion/src/handlers/http.ts` | HTTP request |
| `packages/minion/src/hardware.ts` | Hardware fingerprint |
| `packages/minion/src/config.ts` | Config loader |
| `packages/minion/src/local-api.ts` | Local HTTP server |

## Success Criteria

- [x] `exec` runs shell commands and returns stdout/stderr/exitCode
- [x] `read` returns file contents within maxBytes limit
- [x] `write` creates/overwrites files with optional chmod mode
- [x] `http` makes arbitrary HTTP requests from the device
- [x] Hardware fingerprint is stable across reboots on Pi hardware
- [x] `bun build --compile` produces a single binary that runs on arm64
- [x] Local API accepts instructions over LAN without any hive
