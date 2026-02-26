# 5.2: Monorepo Core Extraction (COMPLETE ✓)

**Effort:** High | **Status:** Complete

## Background

From [OpenClaw Analysis Section 5](../../research/openclaw-analysis.md) (npm package setup) and [Section 6](../../research/openclaw-analysis.md) (brain vs body separation): Extract the "brain" into `@openorbit/core` so it can run without Electron. Electron becomes one consumer of core, alongside CLI and future mobile.

## Target Architecture

```
packages/
  core/                        @openorbit/core
    src/
      ai/                      claude-service, job-analyzer, answer-generator, cover-letter, chat-handler, memory-context
      automation/               session-manager, action-engine, hint-executor, human-behavior, page-reader, extraction-runner
      db/                       database, jobs-repo, profiles-repo, settings-repo, answers-repo, action-log-repo, memory-repo
      platforms/                platform-adapter, linkedin/, indeed/, upwork/
      scheduler/                scheduler
      config/                   config-watcher
      utils/                    logger, rate-limiter, circuit-breaker
      types.ts
      constants.ts
    package.json
    tsconfig.json

  electron/                    @openorbit/electron
    src/
      main/                     index.ts, ipc-handlers.ts, tray.ts, updater.ts
      preload/                  index.ts
      renderer/                 (entire React app)
    package.json
    electron-builder.yml

  cli/                         @openorbit/cli
    src/
      index.ts                  CLI entry point
      commands/                 search, apply, analyze, schedule, status, export
    package.json
```

## Tasks

### Identify Electron Dependencies
- [x] `database.ts` uses `app.getPath('userData')` → abstract to config parameter
- [x] `session-manager.ts` uses `app.getPath('userData')` → abstract to config
- [x] `ipc-handlers.ts` uses `ipcMain` and `BrowserWindow` → stays in Electron package
- [x] `index.ts` is Electron-specific → stays in Electron package

### Dependency Inversion
- [x] Core takes a `Config` object instead of reading from Electron APIs:
  ```typescript
  interface CoreConfig {
    dataDir: string       // replaces app.getPath('userData')
    logDir: string
    hintsDir: string
    apiKeys: string[]
  }
  ```
- [x] Core emits events (EventEmitter) instead of `mainWindow.webContents.send()`
- [x] Electron's `ipc-handlers.ts` becomes a thin adapter: listen to IPC → call core → forward events to renderer

### pnpm Workspaces
- [x] Create `pnpm-workspace.yaml` at root
- [x] Configure workspace dependencies between packages
- [x] Shared `tsconfig.base.json`

### Multiple Export Paths
- [x] `@openorbit/core` exports:
  ```json
  {
    "exports": {
      ".": "./dist/index.js",
      "./platforms": "./dist/platforms/index.js",
      "./ai": "./dist/ai/index.js",
      "./automation": "./dist/automation/index.js",
      "./db": "./dist/db/index.js"
    }
  }
  ```

## Files to Create

```
packages/core/package.json
packages/core/tsconfig.json
packages/core/src/index.ts (barrel exports)
packages/electron/package.json
packages/electron/tsconfig.json
packages/cli/package.json
packages/cli/tsconfig.json
pnpm-workspace.yaml
tsconfig.base.json
```

## Success Criteria

- [x] `@openorbit/core` importable and usable without Electron
- [x] All existing Electron functionality preserved
- [x] `pnpm install` resolves workspace dependencies
- [x] Each package builds independently
