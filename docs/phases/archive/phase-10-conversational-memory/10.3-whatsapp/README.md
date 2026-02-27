# 10.3: WhatsApp

**Effort:** Medium | **Status:** Complete

## Background

WhatsApp is the most-used messaging app globally. The [Baileys](https://github.com/WhiskeySockets/Baileys) library provides a WhatsApp Web protocol implementation in Node.js — no business API, no Twilio, no phone number rental. The user links their WhatsApp account via QR code, same as WhatsApp Web.

Reference: [OpenClaw WhatsApp channel](https://docs.openclaw.ai/channels/whatsapp)

## How It Works

```
Phone (WhatsApp)
    |
    |-- WhatsApp servers
    |       |
    |       |-- Baileys (WhatsApp Web protocol, inside Electron)
    |               |
    |               |-- ext-whatsapp (inside Electron main process)
    |                       |
    |                       |-- AI Gateway (shared pattern)
    |                       |       |-- Memory read/write
    |                       |       |-- AI provider query()
    |                       |       |-- In-process data access
    |                       |
    |                       |-- Baileys socket
    |                               |-- QR code pairing
    |                               |-- Message send/receive
    |                               |-- Read receipts
    |                               |-- Auto-reconnect
```

Baileys maintains a persistent WebSocket connection to WhatsApp servers, similar to how WhatsApp Web works. Messages arrive in real-time via event handlers — no polling, no webhooks, no external server.

## Tasks

### Extension Scaffold
- [ ] Create `packages/extensions/ext-whatsapp/` with standard structure
- [ ] `package.json` with `openorbit` manifest (`id: ext-whatsapp`)
- [ ] Dependency: `@whiskeysockets/baileys`
- [ ] Register as preloaded module in shell bootstrap

### WhatsApp Client (`whatsapp-client.ts`)
- [ ] Initialize Baileys socket with auth state
- [ ] QR code generation for first-time pairing (emit via IPC for renderer display)
- [ ] Credential storage in app data dir (`~/.config/openorbit/whatsapp-auth/`)
- [ ] Auto-reconnect on disconnect with exponential backoff
- [ ] Message event handler → forward to AI Gateway
- [ ] Send text messages (with chunking at 4000 chars)
- [ ] Send read receipts after processing
- [ ] Ignore status broadcasts and group messages (DM-only for MVP)
- [ ] Graceful shutdown on extension deactivation

### AI Gateway (`ai-gateway.ts`)
- [ ] Same pattern as ext-telegram: direct commands + AI fallback
- [ ] Uses shared `extractAndSaveMemories()` from 10.1
- [ ] Uses shared `MemoryContextBuilder.buildChatContext()` from 10.1
- [ ] Creates repos from `ctx.db` (in-process, no RPC hop)
- [ ] Direct commands: `/jobs`, `/approved`, `/status`, `/log`, `/help`

### Authorization
- [ ] Authorized number allowlist in settings (`whatsapp.authorized-numbers`)
- [ ] Number format: E.164 (e.g., `+1234567890`)
- [ ] Reject messages from unauthorized numbers (silent drop)
- [ ] Allow all if no numbers configured (initial setup mode)
- [ ] Self-chat protection — don't respond to own messages

### Settings IPC
- [ ] `ext-whatsapp:config-get` — get authorized numbers, connection status
- [ ] `ext-whatsapp:config-set` — update authorized numbers
- [ ] `ext-whatsapp:status` — connected/disconnected/pairing/error
- [ ] `ext-whatsapp:qr-code` — get current QR code for pairing (push event)

### Response Formatting
- [ ] WhatsApp formatting: `*bold*`, `_italic_`, `~strikethrough~`, ` ```code``` `
- [ ] Emoji for status indicators
- [ ] No inline buttons — WhatsApp doesn't support interactive keyboards in personal accounts
- [ ] Job approve/reject via text commands ("approve 1", "reject 2")

## Extension Structure

```
packages/extensions/ext-whatsapp/
├── package.json
├── src/
│   ├── main/
│   │   ├── index.ts                      # Activate: start Baileys client
│   │   ├── whatsapp-client.ts            # Baileys socket, QR pairing, send/receive
│   │   ├── ai-gateway.ts                 # Direct commands + AI fallback
│   │   └── formatters.ts                 # WhatsApp-style message formatting
│   └── renderer/
│       └── index.ts                      # Empty or QR code display component
```

## Setup

### 1. Configure authorized numbers

| Setting Key | Value | Example |
|-------------|-------|---------|
| `whatsapp.authorized-numbers` | Comma-separated E.164 numbers | `+1234567890,+0987654321` |

### 2. Restart OpenOrbit

The extension starts and generates a QR code for pairing.

### 3. Pair with WhatsApp

1. Open WhatsApp on your phone
2. Go to Settings → Linked Devices → Link a Device
3. Scan the QR code displayed in OpenOrbit (via logs or settings UI)
4. Once paired, the connection persists across restarts (credentials stored locally)

### 4. Test it

Send a WhatsApp message to the linked number. The bot should respond.

## Key Considerations

- **Single device link** — WhatsApp allows up to 4 linked devices. OpenOrbit uses one slot.
- **Credential persistence** — Baileys stores auth state locally. No re-pairing needed after restart unless the link is revoked.
- **No business features** — personal WhatsApp accounts don't support buttons, list messages, or templates. Text-only interaction.
- **Rate limits** — WhatsApp may throttle or ban accounts that send too many automated messages. Keep responses concise and only reply to authorized users.
- **Node.js only** — Baileys is not compatible with Bun runtime.

## Security

- Only authorized phone numbers can interact
- Credentials stored locally in app data directory (not synced)
- Messages encrypted end-to-end by WhatsApp protocol
- No third-party servers — direct WhatsApp Web connection from Electron

## Success Criteria

- [ ] QR code pairing flow works
- [ ] Credentials persist across restarts (no re-pairing)
- [ ] Incoming WhatsApp messages forwarded to AI Gateway
- [ ] Direct commands work (/jobs, /status, etc.)
- [ ] Natural language queries return AI-powered responses
- [ ] Memory extraction works (reads and writes facts)
- [ ] Only authorized numbers can interact
- [ ] Auto-reconnect on disconnect
- [ ] All tests pass
