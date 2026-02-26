# 3.4: Config Hot-Reload (COMPLETE ✓)

**Effort:** Low | **Status:** Complete

## Background

From [OpenClaw Analysis Section 4F](../../research/openclaw-analysis.md): Watch config files, apply changes without restart.

## Tasks

### Config Watcher
- [x] Create `src/main/config/config-watcher.ts`:
  - Use `fs.watch()` on the hints directory and data directory
  - Debounce file change events (300ms)
  - Emit events: `hint-changed`, `settings-changed`

### Apply Changes
- [x] On hint file change: reload `HintBasedExecutor` hint map
- [x] On settings change: propagate to `SettingsRepo` and notify active services
- [x] On API key change: call `ClaudeService.resetClient()`

### Notify Renderer
- [x] Add `CONFIG_CHANGED` channel to `ipc-channels.ts`
- [x] Push event to renderer so UI reflects updates
- [x] Start watcher in `src/main/index.ts` on app ready

## Files to Create

```
src/main/config/config-watcher.ts
```

## Files to Modify

```
src/main/index.ts (start watcher)
src/shared/ipc-channels.ts (CONFIG_CHANGED channel)
src/main/ipc-handlers.ts (config change handler)
```

## Success Criteria

- [x] Editing `linkedin-jobs.json` in a text editor updates hint confidence in the running app
- [x] Changing API key in settings takes effect immediately
- [x] No app restart required for config changes
