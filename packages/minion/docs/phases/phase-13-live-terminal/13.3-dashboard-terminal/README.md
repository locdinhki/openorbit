# 13.3: Dashboard Terminal UI

**Effort:** Moderate | **Status:** Complete

## Background

xterm.js is the same terminal emulator used in VS Code. It renders a fully capable VT100/xterm-256color terminal in the browser and connects to a WebSocket for I/O.

## Tasks

### Install xterm.js

```bash
cd packages/hive/dashboard
npm install xterm xterm-addon-fit xterm-addon-web-links
```

### Terminal Component

- [ ] Create `packages/hive/dashboard/src/components/Terminal.tsx`:
  ```typescript
  interface Props {
    deviceId: string
    token: string
  }
  ```
  - `useEffect`: open `xterm.Terminal`, attach `FitAddon`
  - Connect `new WebSocket(ws://hive/api/pty/${deviceId}?token=${token})`
  - Send `{ type: 'pty-open', cols: term.cols, rows: term.rows }` on WS open
  - `term.onData(data => ws.send(JSON.stringify({ type: 'pty-input', data })))`
  - `ws.onmessage`: parse JSON, on `pty-output` call `term.write(atob(msg.data))`
  - `ResizeObserver` on container → `fitAddon.fit()` → send `pty-resize`
  - Cleanup: `ws.close()`, `term.dispose()` on unmount

### Device Detail Terminal Tab

- [ ] Edit `packages/hive/dashboard/src/pages/DeviceDetail.tsx`:
  - Add "Terminal" tab alongside existing content
  - Tab is disabled + tooltip "Device offline" when `device.status !== 'online'`
  - Lazy-mount `<Terminal>` only when tab is active (avoid connecting WS prematurely)
  - Black background, monospace font, full-height container

## Files

| File | Action |
|------|--------|
| `packages/hive/dashboard/src/components/Terminal.tsx` | CREATE — xterm.js component |
| `packages/hive/dashboard/src/pages/DeviceDetail.tsx` | EDIT — add Terminal tab |
| `packages/hive/dashboard/package.json` | EDIT — add xterm + addons |

## Success Criteria

- [ ] Terminal tab appears on DeviceDetail for online devices
- [ ] Terminal renders with correct dimensions and fills the container
- [ ] Typing characters executes them on the remote device
- [ ] Terminal resizes correctly when the browser window resizes
- [ ] Color output, cursor movement, and escape sequences render correctly
- [ ] Closing the tab disconnects the WebSocket and cleans up the PTY
