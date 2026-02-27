# 10.6: Web Interface

**Effort:** Medium | **Status:** Complete

## Background

Not everyone wants to install Telegram, pair WhatsApp, or set up Discord. A built-in web interface served directly by OpenOrbit provides a zero-install chat UI accessible from any browser — phone, tablet, or another computer. Open a URL, authenticate, and start chatting.

The web UI is served from the same process that hosts the RPC server, making it the simplest access method. With Tailscale (Phase 7.4), it's accessible from anywhere on the user's tailnet.

Reference: [OpenClaw web interface](https://docs.openclaw.ai/web)

## How It Works

```
Browser (phone / tablet / laptop)
    |
    |-- HTTPS (via Tailscale) or HTTP (localhost)
    |       |
    |       |-- Static file server (Electron main process)
    |       |       |
    |       |       |-- Serves built web UI assets (HTML/CSS/JS)
    |       |
    |       |-- WebSocket connection
    |               |
    |               |-- RPC server (existing, port 18790)
    |               |       |-- Authenticate with token
    |               |       |-- Send/receive chat messages
    |               |       |-- Job list, approve/reject, status
    |               |
    |               |-- AI Gateway (server-side)
    |                       |-- Memory read/write
    |                       |-- AI provider query()
    |                       |-- In-process data access
```

The web interface is a lightweight SPA (single-page app) that connects to the existing RPC WebSocket server. It reuses the same protocol the CLI and mobile app already use — no new server needed.

## Tasks

### Web UI Package (`packages/web-ui/`)
- [ ] Create new package with Vite + React (matches existing renderer stack)
- [ ] Lightweight chat-focused UI — not a full dashboard clone
- [ ] Build output to `dist/` — served as static files by Electron

### Chat View
- [ ] Message input with send button
- [ ] Message history (scrollable, auto-scroll to bottom)
- [ ] Markdown rendering for AI responses
- [ ] Job cards with approve/reject buttons (inline)
- [ ] Loading indicator while AI is processing
- [ ] Mobile-responsive layout (primary use case is phone browser)

### Job List View
- [ ] Tabbed or sidebar navigation: Chat | Jobs | Status
- [ ] Job list with status filters (new, approved, applied)
- [ ] Job detail view with match score, summary, highlights, red flags
- [ ] Approve/reject buttons on job cards

### Status View
- [ ] Automation status (running/stopped, duration, counts)
- [ ] Recent action log entries
- [ ] Search profiles list

### Static File Server
- [ ] Serve web UI assets from Electron main process
- [ ] HTTP server on configurable port (default: 18791, next to RPC on 18790)
- [ ] Serve `index.html` for all routes (SPA fallback)
- [ ] Only serve when web UI assets exist in the build output
- [ ] Respect `rpc.bind-host` setting (same bind address as RPC server)

### WebSocket Chat Protocol
- [ ] New RPC methods for web chat:
  - `chat.send` — send message, receive AI response
  - `chat.history` — get conversation history
  - `chat.clear` — clear conversation
- [ ] Reuse existing RPC methods for data:
  - `jobs.list`, `jobs.approve`, `jobs.reject` (already exist)
  - `automation.status` (already exists)
  - `action-log.list` (already exists)
- [ ] Token authentication (same as existing RPC auth)

### AI Gateway (Server-Side)
- [ ] Chat messages routed through ChatHandler (same as in-app chat)
- [ ] Memory read/write via extractAndSaveMemories() (from 10.1)
- [ ] Same system prompt and behavior as desktop chat

### Authentication
- [ ] Token-based auth (same UUID token as RPC server)
- [ ] Login page: enter token or scan QR code
- [ ] Token stored in browser localStorage after first auth
- [ ] Session persists until token changes or user logs out

### Pairing
- [ ] Web UI URL included in pairing QR code payload
- [ ] QR payload adds: `webUrl: "http://<host>:18791"`
- [ ] When scanned, opens browser to web UI with token pre-filled

## Package Structure

```
packages/web-ui/
├── package.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx                          # React entry point
│   ├── App.tsx                           # Router: Login | Chat | Jobs | Status
│   ├── lib/
│   │   ├── rpc-client.ts                # WebSocket RPC client (reuse pattern from CLI)
│   │   └── auth.ts                      # Token storage + validation
│   ├── components/
│   │   ├── Login.tsx                     # Token input / QR scan
│   │   ├── Chat.tsx                      # Chat message list + input
│   │   ├── ChatMessage.tsx               # Single message bubble (user/assistant)
│   │   ├── JobList.tsx                   # Filterable job list
│   │   ├── JobCard.tsx                   # Job card with approve/reject
│   │   ├── StatusDashboard.tsx           # Automation status + action log
│   │   └── Navigation.tsx                # Bottom tab bar (mobile-friendly)
│   └── styles/
│       └── main.css                      # Mobile-first responsive styles
└── dist/                                 # Build output (served by Electron)
```

## Server-Side Changes

```
src/main/
├── web-server.ts                         # CREATE — static file server + SPA fallback
├── index.ts                              # EDIT — start web server alongside RPC server
├── rpc-server.ts                         # EDIT — add chat.send, chat.history, chat.clear methods
└── ipc-handlers.ts                       # EDIT — add webUrl to pairing info
```

## Setup

### No setup required

The web interface is built into OpenOrbit and served automatically. After starting the app:

1. Open a browser to `http://localhost:18791`
2. Enter the RPC token (from pairing QR code or settings)
3. Start chatting

### Remote access (with Tailscale)

If Tailscale is configured (Phase 7.4):

1. Open `http://<tailnet-ip>:18791` from any device on the tailnet
2. Authenticate with the same RPC token
3. Works from phone browser, tablet, or another computer

## Design Principles

- **Mobile-first** — primary use case is phone browser. Large touch targets, bottom navigation, responsive layout.
- **Chat-centric** — chat is the default view, not a dashboard. Jobs and status are secondary tabs.
- **Lightweight** — minimal bundle size. No heavy UI frameworks beyond React. Fast load over Tailscale.
- **Reuse existing infra** — connects to the same RPC server, same auth, same AI gateway. No new backend services.

## Key Considerations

- **No HTTPS on localhost** — browsers may show "not secure" warning. Tailscale Serve can proxy HTTPS if needed.
- **WebSocket reconnect** — handle dropped connections gracefully (auto-reconnect with backoff)
- **No push notifications** — browser tabs don't receive push. User must keep the tab open.
- **Build step** — web UI must be built (`npm run build` in packages/web-ui) and output included in Electron app packaging
- **Port conflict** — default port 18791 should be configurable via `web.port` setting

## Settings

| Setting Key | Default | Description |
|-------------|---------|-------------|
| `web.enabled` | `true` | Enable/disable web interface |
| `web.port` | `18791` | HTTP server port |

## Security

- Same token auth as RPC server — no weaker access path
- Token stored in browser localStorage (cleared on logout)
- No public internet exposure without Tailscale Funnel (not recommended)
- CORS restricted to same-origin by default
- All AI processing on the server (nothing runs in the browser)

## Success Criteria

- [ ] Web UI loads in mobile browser
- [ ] Token authentication works
- [ ] Chat messages sent and AI responses received
- [ ] Job list displays with approve/reject buttons
- [ ] Status dashboard shows automation info
- [ ] Mobile-responsive layout (works on phone screens)
- [ ] Accessible via Tailscale from outside LAN
- [ ] WebSocket reconnects on connection drop
- [ ] Web URL included in pairing QR code
- [ ] `npx vitest run` — all tests pass
- [ ] `npx electron-vite build` — build succeeds
