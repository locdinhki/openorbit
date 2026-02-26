# 10.2: iMessage / BlueBubbles

**Effort:** Medium | **Status:** Not started

## Background

iMessage is the default messaging app on iOS — no separate install needed. [BlueBubbles](https://bluebubbles.app) is a macOS server that exposes iMessage via a REST API with webhook-based message delivery. Since OpenOrbit already runs on the user's Mac, BlueBubbles runs alongside it — no additional hardware needed.

Reference: [OpenClaw BlueBubbles channel](https://docs.openclaw.ai/channels/bluebubbles)

## How It Works

```
iPhone (iMessage)
    |
    |-- Apple iMessage servers
    |       |
    |       |-- Messages.app on Mac
    |               |
    |               |-- BlueBubbles macOS server (REST API + webhooks)
    |                       |
    |                       |-- ext-imessage (inside Electron main process)
    |                               |
    |                               |-- AI Gateway (shared pattern)
    |                               |       |-- Memory read/write
    |                               |       |-- AI provider query()
    |                               |       |-- In-process data access
    |                               |
    |                               |-- BlueBubbles REST client
    |                                       |-- Send messages
    |                                       |-- Receive via webhook
    |                                       |-- Typing indicators
    |                                       |-- Read receipts
```

Unlike Telegram (which uses long polling), BlueBubbles uses **webhooks** — it POSTs incoming messages to a configured endpoint. The ext-imessage extension runs a small HTTP server inside Electron to receive these webhooks.

## Tasks

### Extension Scaffold
- [ ] Create `packages/extensions/ext-imessage/` with standard structure
- [ ] `package.json` with `openorbit` manifest (`id: ext-imessage`)
- [ ] Register as preloaded module in shell bootstrap

### BlueBubbles Client (`bluebubbles-client.ts`)
- [ ] REST client for BlueBubbles HTTP API using native `fetch()`
- [ ] `GET /api/v1/ping` — health check on startup
- [ ] `POST /api/v1/message/text` — send text message
- [ ] `POST /api/v1/message/attachment` — send media (optional, for job screenshots)
- [ ] Typing indicator before AI processing
- [ ] Read receipt after processing
- [ ] Message chunking for responses over 4000 chars
- [ ] Authentication via password header on all requests

### Webhook Receiver (`webhook-server.ts`)
- [ ] HTTP server on configurable port (default: 18792)
- [ ] `POST /webhook/imessage` — receive incoming messages
- [ ] Verify webhook password from query param or header
- [ ] Parse BlueBubbles webhook payload → extract text, sender handle, chat GUID
- [ ] Ignore group messages (DM-only for MVP)
- [ ] Forward to AI Gateway

### AI Gateway (`ai-gateway.ts`)
- [ ] Same pattern as ext-telegram: direct commands + AI fallback
- [ ] Uses shared `extractAndSaveMemories()` from 10.1
- [ ] Uses shared `MemoryContextBuilder.buildChatContext()` from 10.1
- [ ] Creates repos from `ctx.db` (in-process, no RPC hop)
- [ ] Direct commands: `/jobs`, `/approved`, `/status`, `/log`, `/help` (parsed from message text)

### Authorization
- [ ] Authorized handle allowlist in settings (`imessage.authorized-handles`)
- [ ] Handle format: phone number or iMessage email (e.g., `+1234567890`, `user@icloud.com`)
- [ ] Reject messages from unauthorized handles (silent drop)
- [ ] Allow all if no handles configured (initial setup mode)

### Settings IPC
- [ ] `ext-imessage:config-get` — get server URL, password, authorized handles, status
- [ ] `ext-imessage:config-set` — update configuration
- [ ] `ext-imessage:status` — server connected/disconnected/error

### Response Formatting
- [ ] Plain text formatting (iMessage has limited rich text)
- [ ] Emoji for status indicators
- [ ] No inline keyboards — use tapback reactions for acknowledge only
- [ ] Job approve/reject via text commands ("approve 1", "reject 2")

## Extension Structure

```
packages/extensions/ext-imessage/
├── package.json
├── src/
│   ├── main/
│   │   ├── index.ts                      # Activate: start webhook server + BB client
│   │   ├── bluebubbles-client.ts         # REST client for BlueBubbles API
│   │   ├── webhook-server.ts             # HTTP server for incoming webhooks
│   │   ├── ai-gateway.ts                 # Direct commands + AI fallback
│   │   └── formatters.ts                 # Plain text message formatting
│   └── renderer/
│       └── index.ts                      # Empty (no UI)
```

## Setup

### 1. Install BlueBubbles

Download from [bluebubbles.app](https://bluebubbles.app) and run on your Mac. Enable the web API in BlueBubbles settings and set a password.

### 2. Configure in OpenOrbit

| Setting Key | Value | Example |
|-------------|-------|---------|
| `imessage.server-url` | BlueBubbles server URL | `http://localhost:1234` |
| `imessage.password` | BlueBubbles API password | `my-secret-password` |
| `imessage.authorized-handles` | Comma-separated phone numbers or emails | `+1234567890,user@icloud.com` |

### 3. Configure webhook in BlueBubbles

Point BlueBubbles to send webhooks to:
```
http://localhost:18792/webhook/imessage?password=<your-password>
```

### 4. Restart OpenOrbit

Check logs for `"ext-imessage: connected to BlueBubbles"` and `"ext-imessage: webhook server listening on port 18792"`.

### 5. Test it

Send an iMessage to yourself (or from your phone to the Mac's iMessage). The bot should respond.

## Platform Constraints

- **macOS only** — BlueBubbles requires the Mac's Messages.app
- **No inline buttons** — iMessage doesn't support interactive keyboards; use text commands instead
- **Webhook dependency** — requires BlueBubbles to be running alongside OpenOrbit
- **Message editing** — supported on macOS 13+ but not critical for MVP

## Security

- Webhook requests verified via password parameter
- Only authorized iMessage handles can interact
- All traffic is local (localhost webhook) unless Tailscale is configured
- BlueBubbles password stored in OpenOrbit settings DB (not plaintext files)

## Success Criteria

- [ ] Extension connects to BlueBubbles and verifies health
- [ ] Incoming iMessages forwarded to AI Gateway
- [ ] Direct commands work (/jobs, /status, etc.)
- [ ] Natural language queries return AI-powered responses
- [ ] Memory extraction works (reads and writes facts)
- [ ] Only authorized handles can interact
- [ ] Typing indicator shown while processing
- [ ] All tests pass
