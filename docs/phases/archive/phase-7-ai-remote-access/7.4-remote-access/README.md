# 7.4: Remote Access

**Effort:** Low | **Status:** Complete

## Background

The RPC server currently binds to `127.0.0.1:18790` (localhost only). For phone access outside the home LAN, the server needs to be reachable remotely. Tailscale provides a zero-config encrypted mesh VPN that's free for personal use — no port forwarding, no public exposure.

## How It Works

```
Phone (on cellular / away from home)
    |
    |-- Tailscale (encrypted WireGuard tunnel)
    |       |
    |       |-- Tailnet IP (e.g., 100.64.x.x)
    |               |
    |               |-- OpenOrbit RPC Server (100.64.x.x:18790)
    |               |-- openorbit-mcp HTTP/SSE (100.64.x.x:18791)
```

No code dependency on Tailscale — it's purely a network-level solution. OpenOrbit just needs to bind to the tailnet interface instead of localhost.

## Tasks

### Configurable Bind Host
- [x] Add `rpc.bind-host` setting (default: `127.0.0.1`)
- [x] Modify `src/main/rpc-server.ts` to accept host parameter
- [x] When set to `0.0.0.0` or a specific IP, bind accordingly
- [x] Log warning when binding to non-loopback address

### Tailscale Detection
- [x] Detect Tailscale: check network interfaces for `utun` (macOS) with 100.x.x.x range
- [x] Auto-detect tailnet IP for QR code pairing
- [x] Graceful fallback if Tailscale not installed

### Pairing Update
- [x] Update `rpc:pairing-info` IPC handler to prefer tailnet IP when available
- [x] QR payload includes tailnet URL: `{ wsUrl: "ws://100.64.x.x:18790", token: "..." }`
- [ ] Show both LAN and tailnet URLs in pairing UI (renderer change — deferred)

### MCP Server Remote Mode
- [x] `openorbit-mcp` supports `--host` and `--port` flags for HTTP/SSE transport
- [ ] Listens on tailnet IP when available (future enhancement)
- [ ] Can be added to Claude's remote MCP config (future enhancement)

## Setup

### 1. Install Tailscale

**Mac (home computer running OpenOrbit):**
```bash
brew install tailscale
# or download from https://tailscale.com/download
```

**Phone:**
- iOS: [App Store](https://apps.apple.com/app/tailscale/id1470499037)
- Android: [Google Play](https://play.google.com/store/apps/details?id=com.tailscale.ipn)

### 2. Log in on both devices

Sign in with the same Tailscale account on your Mac and phone. Both devices automatically get tailnet IPs (100.x.x.x range).

### 3. Configure OpenOrbit to bind to all interfaces

Set the RPC bind host in OpenOrbit settings:

| Setting Key | Value | Description |
|-------------|-------|-------------|
| `rpc.bind-host` | `0.0.0.0` | Bind to all interfaces (tailnet + LAN + localhost) |

Or set it to your specific tailnet IP (e.g., `100.100.50.1`) for more restrictive binding.

### 4. Restart OpenOrbit

The RPC server will start on the configured bind host. Check logs for:
- `"RPC server listening on ws://0.0.0.0:18790"` (or your tailnet IP)
- A warning about non-loopback binding (expected)

### 5. Connect from phone

OpenOrbit auto-detects the tailnet IP and includes it in the pairing QR code. The pairing info now contains:
- `wsUrl`: LAN IP (`ws://192.168.x.x:18790`)
- `tailnetUrl`: Tailnet IP (`ws://100.x.x.x:18790`) — use this when away from home

### 6. Verify

From your phone (on cellular, not WiFi), open the OpenOrbit companion app and scan the QR code, or manually connect to the tailnet URL.

## Security Considerations

- Token auth remains required (same UUID-based auth as localhost)
- Tailscale encrypts all traffic via WireGuard
- Only devices on the user's tailnet can reach the IP
- No public internet exposure
- Optional: Tailscale ACLs can further restrict which devices connect

## Success Criteria

- [x] RPC server binds to configurable host
- [x] Tailnet IP auto-detected when Tailscale is running
- [x] QR pairing includes tailnet URL when available
- [ ] Mobile app connects from outside LAN via Tailscale (manual test pending)
- [ ] MCP server accessible from phone's Claude via HTTP/SSE transport (future enhancement)
