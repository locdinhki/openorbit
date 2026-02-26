# Phase 5: Architecture Evolution (COMPLETE ✓)

**Theme:** Decouple core from Electron for distribution as CLI, SDK, and platform.

**Effort:** Very High | **Depends on:** Phase 4 | **Status:** Complete

## Why This Phase

All features are stable. Now we extract the "brain" so it can run without Electron — enabling a CLI tool, a headless mode, and eventually a mobile app. This is the OpenClaw "brain vs body" separation applied to OpenOrbit.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 5.1 | [WebSocket RPC](5.1-websocket-rpc/) | Moderate-High | JSON-RPC protocol decoupling core from Electron IPC |
| 5.2 | [Monorepo Core Extraction](5.2-monorepo-core-extraction/) | High | @openorbit/core, @openorbit/electron, @openorbit/cli packages |
| 5.3 | [CLI Tool](5.3-cli-tool/) | Moderate | Headless search, analyze, apply commands |

## OpenClaw Analysis References

- 5.1: Section 4H (WebSocket/gateway architecture)
- 5.2: Section 5 (npm package setup, dual distribution) + Section 6 (brain/body separation)

## Architecture Target

```
packages/
  core/                        @openorbit/core
    src/
      ai/                      claude-service, job-analyzer, answer-generator, cover-letter
      automation/               session-manager, action-engine, hint-executor, human-behavior
      db/                       database, all repos
      platforms/                platform-adapter, linkedin/, indeed/, upwork/
      scheduler/
      config/
      utils/
  electron/                    @openorbit/electron
    src/
      main/                     index.ts, ipc-handlers.ts, tray.ts, updater.ts
      preload/
      renderer/
  cli/                         @openorbit/cli
    src/
      commands/                 search, apply, analyze, schedule, status, export
```

## Success Criteria

- [x] `@openorbit/core` can be imported and used without Electron
- [x] WebSocket server accepts authenticated connections on localhost (port 18790, token auth)
- [x] CLI can search LinkedIn headlessly via `openorbit search --profile "senior react"`
- [x] All existing Electron functionality preserved (Electron is just another consumer of core)
