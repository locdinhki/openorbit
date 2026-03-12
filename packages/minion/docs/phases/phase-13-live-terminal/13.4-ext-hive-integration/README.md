# 13.4: ext-hive Integration

**Effort:** Low | **Status:** Complete (Option B — native xterm.js in Electron renderer)

## Background

The OpenOrbit desktop app (ext-hive) should also be able to open a terminal panel for a device. Since Electron can render a browser window, an embedded webview pointing to the dashboard terminal page is the simplest approach — or a custom xterm.js component in the renderer.

## Tasks

### Option A: Webview to Dashboard Terminal (Simpler)

- [ ] Add `openTerminal(deviceId)` to HiveClient — returns dashboard URL
- [ ] Add IPC channel `ext-hive:open-terminal` → opens terminal URL in external browser or embedded webview
- [ ] AI tool: `open_terminal` — opens a terminal for a given device (23 total tools)

### Option B: Native xterm in Renderer (Richer)

- [ ] Add `xterm` and `xterm-addon-fit` to ext-hive renderer dependencies
- [ ] Create `packages/extensions/ext-hive/src/renderer/HiveTerminal.tsx` — same component as dashboard
- [ ] Register new workspace view `hive-terminal` in package.json contributes
- [ ] IPC: `ext-hive:open-terminal` → returns WS URL for the device's PTY relay
- [ ] Renderer connects directly to hive WS from Electron (no CORS issues)

**Recommendation:** Start with Option A (1 day) to unblock; Option B is a full xterm.js embed.

## Files (Option A)

| File | Action |
|------|--------|
| `packages/extensions/ext-hive/src/main/hive-client.ts` | EDIT — `getTerminalUrl(deviceId)` |
| `packages/extensions/ext-hive/src/ipc-channels.ts` | EDIT — `ext-hive:open-terminal` |
| `packages/extensions/ext-hive/src/main/ipc-handlers.ts` | EDIT — open terminal handler |
| `packages/extensions/ext-hive/src/main/ai/hive-tools.ts` | EDIT — `open_terminal` tool |

## Success Criteria

- [ ] AI can open a terminal for a device by saying "open terminal on minion-01"
- [ ] Terminal opens in dashboard (Option A) or embedded panel (Option B)
- [ ] IPC channel follows `/^[a-z-]+:[a-z-]+$/` naming rule
