# 13.2: Hive PTY Relay

**Effort:** Moderate | **Status:** Complete

## Background

The hive relays PTY data between two WebSocket connections: the dashboard client (browser) and the minion. It must maintain a session map that tracks which dashboard WS maps to which minion + sessionId.

## Tasks

### New Dashboard WebSocket Endpoint

- [ ] Edit `packages/hive/src/ws-server.ts` or create `packages/hive/src/pty-relay.ts`:
  - New WS server path: `ws://hive/api/pty/:deviceId`
  - Auth: same Bearer token as REST (read from `?token=` query param or first WS message)
  - On connect: look up device, verify it's online
  - On `pty-open` from dashboard: forward to minion WS with generated `sessionId`
  - On `pty-input` from dashboard: forward to minion WS
  - On `pty-resize` from dashboard: forward to minion WS
  - On `pty-output` from minion: forward to correct dashboard WS client
  - On `pty-close` from either side: close both and clean up session map
  - On dashboard WS disconnect: send `pty-close` to minion

### Session Map

```typescript
interface PtySession {
  sessionId: string
  deviceId: string
  dashboardWs: WebSocket
  // minion WS is looked up from existing device connection map
}
```

### Minion Message Routing

The existing `ws-server.ts` already has a `Map<string, WebSocket>` of device connections. PTY relay reuses this — no new persistent connections needed.

## Files

| File | Action |
|------|--------|
| `packages/hive/src/pty-relay.ts` | CREATE — dashboard WS handler + session map |
| `packages/hive/src/ws-server.ts` | EDIT — export device connection map, handle pty-output routing |
| `packages/hive/src/index.ts` | EDIT — mount pty-relay WS server |

## Success Criteria

- [ ] Dashboard can open `ws://hive/api/pty/:deviceId` with a valid token
- [ ] Keystrokes from dashboard reach the minion PTY
- [ ] PTY output from minion reaches the dashboard WS client
- [ ] Disconnecting the dashboard WS sends `pty-close` to the minion
- [ ] Two concurrent sessions on different devices work independently
