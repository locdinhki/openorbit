# Phase 13: Live Terminal

**Theme:** Full interactive shell in the browser — xterm.js on the dashboard + node-pty on the minion, relayed over the existing WebSocket connection.

**Effort:** Large | **Depends on:** Phase 6 (dashboard) + Phase 3 (minion WS) | **Status:** Complete

## Why This Phase

Task dispatch (fire a command, get stdout back) is useful for scripting but breaks down for interactive work: you can't use `top`, `htop`, `vim`, `tail -f`, or anything that expects a real TTY. A live terminal turns the dashboard into a browser-based SSH client — the single most impactful UX upgrade possible for a fleet management platform.

**Reference implementations using the same stack:**
- VS Code integrated terminal (`xterm.js` + `node-pty`, exact same libs)
- `ttyd` — open source browser terminal
- `wetty` — Web + TTY, browser SSH client

## Architecture

```
Dashboard (/devices/:id/terminal)
    │  ws://hive/api/pty/:deviceId
    │  {type: "pty-input", data: "\x03"}   ← keystrokes
    │  {type: "pty-output", data: "..."}   ← terminal output
    ▼
Hive (PTY relay)
    │  existing minion WS connection
    │  {type: "pty-open", cols, rows}
    │  {type: "pty-input", data: "..."}
    │  {type: "pty-output", data: "..."}
    │  {type: "pty-close"}
    ▼
Minion (node-pty)
    └── spawn PTY (/bin/bash) → pipe stdin/stdout
```

One PTY session per dashboard client. Hive acts as a relay — it doesn't interpret PTY data, just forwards bytes.

## New Message Types (Minion ↔ Hive WS)

| Type | Direction | Payload | Purpose |
|------|-----------|---------|---------|
| `pty-open` | Hive → Minion | `{ sessionId, cols, rows, shell? }` | Spawn PTY |
| `pty-input` | Hive → Minion | `{ sessionId, data: string }` | Keystrokes (base64) |
| `pty-output` | Minion → Hive | `{ sessionId, data: string }` | Terminal output (base64) |
| `pty-resize` | Hive → Minion | `{ sessionId, cols, rows }` | Terminal resize |
| `pty-close` | Both directions | `{ sessionId }` | Close session |

## Subphases

| # | Subphase | Description |
|---|----------|-------------|
| 13.1 | [Minion PTY Handler](13.1-minion-pty/) | `node-pty` integration, session management, WS message handling |
| 13.2 | [Hive PTY Relay](13.2-hive-pty-relay/) | Dashboard WS endpoint, relay between browser and minion |
| 13.3 | [Dashboard Terminal UI](13.3-dashboard-terminal/) | xterm.js component, device detail terminal tab |
| 13.4 | [ext-hive Integration](13.4-ext-hive-integration/) | IPC channels + OpenOrbit panel for terminal sessions |

## Key Dependencies

| Package | Where | Purpose |
|---------|-------|---------|
| `node-pty` | `packages/minion/` | Spawn real PTY on the device |
| `xterm` | `packages/hive/dashboard/` | Browser terminal emulator |
| `xterm-addon-fit` | dashboard | Resize terminal to container |
| `ws` | `packages/hive/` | Already present — new endpoint only |

## Security Considerations

- PTY sessions are gated behind the same `requireAuth` middleware as all REST routes
- Minion must validate the `pty-open` message source (hive, not arbitrary WS client)
- `allowedOps` should include a new `'pty'` type to opt devices in/out
- Sessions auto-close after 5 minutes of inactivity (configurable)
- All PTY data is base64-encoded in WS frames — no binary frame support needed

## Success Criteria

- [ ] Click "Terminal" tab on a device detail page → interactive shell appears
- [ ] `top`, `vim`, `htop` all work (real PTY, not just stdout capture)
- [ ] Terminal resizes correctly when browser window changes
- [ ] Closing the tab sends `pty-close` and cleans up the PTY process on the minion
- [ ] Concurrent sessions work (two browser tabs, two PTY processes)
- [ ] Session auto-closes after inactivity timeout
- [ ] Offline devices show disabled Terminal tab
