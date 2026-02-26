# 5.1: WebSocket RPC Layer (COMPLETE ✓)

**Effort:** Moderate-High | **Status:** Complete

## Background

From [OpenClaw Analysis Section 4H](../../research/openclaw-analysis.md): Replace raw Electron IPC with structured WebSocket RPC. This decouples the core engine from Electron, enabling CLI, mobile, and web clients to connect.

## Tasks

### RPC Protocol
- [x] Create `src/shared/rpc-protocol.ts`:
  - JSON-RPC 2.0 inspired format:
    - Request: `{ id: string, method: string, params: object }`
    - Response: `{ id: string, result?: object, error?: { code, message } }`
  - Server-sent events for push notifications:
    - `automation:status`, `jobs:new`, `application:progress`
  - 1:1 mapping to existing IPC channels (same method names)

### WebSocket Server
- [x] Create `src/main/rpc/ws-server.ts`:
  - WebSocket server on `localhost:18790` (configurable)
  - Token-based authentication (token stored in settings)
  - Connection lifecycle: auth → subscribe → request/response
  - Heartbeat/keepalive
- [x] Create `src/main/rpc/ws-handler.ts`:
  - Routes RPC methods to the same handler logic as IPC handlers
  - Reuses Zod validation from Phase 1.2

### WebSocket Client
- [x] Create `src/renderer/src/lib/ws-client.ts`:
  - Drop-in replacement for `window.api.invoke()` and `window.api.on()`
  - Same typed interface as IPC client from Phase 1.2
  - Renderer can choose transport: IPC (Electron native) or WebSocket

### Dual Transport
- [x] Keep Electron IPC working alongside WebSocket
- [x] Feature flag or auto-detect (IPC when in Electron, WebSocket otherwise)
- [x] WebSocket becomes the primary path for new clients

## Files to Create

```
src/shared/rpc-protocol.ts
src/main/rpc/ws-server.ts
src/main/rpc/ws-handler.ts
src/renderer/src/lib/ws-client.ts
```

## Files to Modify

```
src/main/index.ts (start WebSocket server)
src/shared/ipc-channels.ts (ensure 1:1 method mapping)
```

## Success Criteria

- [x] WebSocket server accepts authenticated connections
- [x] All IPC operations work identically over WebSocket
- [x] Push events (automation status, new jobs) delivered in real-time
- [x] Electron renderer still works via IPC (backward compatible)
