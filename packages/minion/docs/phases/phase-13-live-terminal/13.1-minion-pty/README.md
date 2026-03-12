# 13.1: Minion PTY Handler

**Effort:** Moderate | **Status:** Complete

## Background

The minion currently handles instructions synchronously (receive → execute → return result). PTY sessions are persistent and bidirectional — the minion needs a session map and must stream output back as it arrives, not buffer it.

## Tasks

### Install node-pty

```bash
cd packages/minion
bun add node-pty
```

`node-pty` compiles a native addon. Bun's `--compile` supports native addons via `--external-native-modules` or by bundling the `.node` file alongside the binary.

### Add `pty` to InstructionType

- [ ] Edit `packages/minion/src/types.ts`:
  - Add `'pty'` to `InstructionType` union
  - Add `PtyOpenMessage`, `PtyInputMessage`, `PtyResizeMessage`, `PtyCloseMessage` interfaces

### PTY Session Manager

- [ ] Create `packages/minion/src/pty-sessions.ts`:
  ```typescript
  class PtySessions {
    private sessions: Map<string, IPty>
    open(sessionId: string, cols: number, rows: number, shell?: string): void
    input(sessionId: string, data: string): void
    resize(sessionId: string, cols: number, rows: number): void
    close(sessionId: string): void
    closeAll(): void
  }
  ```
  - `open()`: `spawn('/bin/bash', [], { cols, rows, name: 'xterm-256color' })`
  - Pipe `pty.onData` → send `pty-output` WS message back to hive
  - Pipe `pty.onExit` → send `pty-close` and remove from session map

### Wire into Connection Handler

- [ ] Edit `packages/minion/src/connection.ts`:
  - On message type `pty-open` → `ptySessions.open(...)`
  - On message type `pty-input` → `ptySessions.input(...)`
  - On message type `pty-resize` → `ptySessions.resize(...)`
  - On message type `pty-close` → `ptySessions.close(...)`
  - On WS close → `ptySessions.closeAll()`

### Config Gate

- [ ] Add `'pty'` to `allowedOps` check (same as exec — opt-in per device)
- [ ] Inactivity timeout: close PTY after N seconds of no input (default 300s)

## Files

| File | Action |
|------|--------|
| `packages/minion/src/types.ts` | EDIT — add pty message types |
| `packages/minion/src/pty-sessions.ts` | CREATE — session map + node-pty integration |
| `packages/minion/src/connection.ts` | EDIT — handle pty-* message types |
| `packages/minion/package.json` | EDIT — add node-pty dependency |

## Success Criteria

- [ ] `pty-open` spawns a real bash process with PTY
- [ ] Typing in the session sends characters that bash executes
- [ ] `pty-output` messages stream back continuously (not buffered)
- [ ] `pty-close` kills the PTY process and removes the session
- [ ] Closing the WS connection closes all open PTY sessions
