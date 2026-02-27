# Phase 10: Conversational Memory & Messaging Channels

**Theme:** Make AI conversations learn and remember, open new messaging channels (iMessage, WhatsApp, Discord), add voice message understanding, and provide a built-in web chat interface.

**Effort:** High | **Depends on:** Phase 7 (AI providers, Telegram bot) | **Status:** Complete

## Why This Phase

**Memory:** OpenOrbit has a complete memory backend (`memory_facts` table, FTS5 search, `MemoryRepo`, `MemoryContextBuilder`) already wired into `JobAnalyzer` and `AnswerGenerator`. But the conversational interfaces — `ChatHandler` and Telegram `AIGateway` — neither read from memory nor write to it. The chat can't remember what you said yesterday.

**Messaging channels:** Telegram (Phase 7) proved the pattern works — a messaging bot inside Electron that uses the AI provider to understand natural language and call OpenOrbit tools. But Telegram isn't everyone's app. iMessage (via BlueBubbles), WhatsApp (via Baileys), and Discord each have large user bases and different strengths. Following the [OpenClaw](https://docs.openclaw.ai/) pattern, each channel becomes a standalone extension with the same architecture: long polling / webhook → AI gateway → in-process data access.

**Voice:** Users send voice messages on every channel. Without speech-to-text, these are ignored. Whisper (OpenAI's open-source model) runs locally on the Mac — no API key, no cloud, no cost.

**Web interface:** Not everyone wants to install a messaging app. A built-in web UI served by OpenOrbit gives any browser instant access — phone, tablet, laptop. With Tailscale it works from anywhere.

This phase adds:
- **Inline memory extraction** across all chat interfaces (zero extra API calls)
- **ext-imessage** — iMessage gateway via BlueBubbles macOS server
- **ext-whatsapp** — WhatsApp gateway via Baileys (WhatsApp Web bridge)
- **ext-discord** — Discord bot gateway via Discord.js
- **Voice messages** — local Whisper STT across all channels
- **Web interface** — built-in browser chat UI served by Electron

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 10.1 | [Inline Memory Extraction](10.1-inline-memory-extraction/) | Low | Tag-based fact extraction from AI responses, memory context in chat, wired into all gateways |
| 10.2 | [iMessage / BlueBubbles](10.2-imessage-bluebubbles/) | Medium | iMessage gateway via BlueBubbles REST API + webhooks |
| 10.3 | [WhatsApp](10.3-whatsapp/) | Medium | WhatsApp gateway via Baileys (WhatsApp Web protocol) |
| 10.4 | [Discord](10.4-discord/) | Medium | Discord bot gateway via Discord.js |
| 10.5 | [Voice Messages](10.5-voice-messages/) | Medium | Local Whisper STT for voice messages across all channels |
| 10.6 | [Web Interface](10.6-web-interface/) | Medium | Built-in browser chat UI served by Electron |

## Architecture Overview

All messaging extensions follow the same pattern established by `ext-telegram`:

```
Phone (iMessage / WhatsApp / Discord)
    |
    |-- Channel-specific transport (REST webhook / WhatsApp Web / Discord gateway)
    |       |
    |       |-- ext-<channel> (inside Electron main process)
    |               |
    |               |-- AI Gateway (shared pattern)
    |               |       |
    |               |       |-- MemoryContextBuilder.buildChatContext()  ← memory READ
    |               |       |-- AI provider query() with system prompt
    |               |       |-- extractAndSaveMemories()                 ← memory WRITE
    |               |       |
    |               |       |-- In-process data access (repos, no RPC hop)
    |               |
    |               |-- Channel-specific features
    |                       |-- Inline keyboards / buttons (approve/reject)
    |                       |-- Media handling (attachments, voice)
    |                       |-- Message formatting (Markdown, embeds)
```

### Shared Components

Each messaging extension reuses:
- **AI Gateway pattern** from ext-telegram — direct commands + AI fallback
- **Formatters** — job list, status summary, action log (adapted per channel's formatting)
- **MemoryContextBuilder** — reads stored facts into system prompt
- **extractAndSaveMemories()** — parses `<memory>` tags from AI responses
- **Repos** — JobsRepo, ProfilesRepo, ActionLogRepo, ApplicationsRepo (via `ctx.db`)

### Channel Comparison

| Feature | Telegram | iMessage | WhatsApp | Discord | Web UI |
|---------|----------|----------|----------|---------|--------|
| Transport | Long polling | BlueBubbles REST + webhooks | Baileys (WhatsApp Web) | Discord.js gateway | WebSocket (RPC) |
| Auth model | Bot token + chat ID | BlueBubbles password + webhook auth | QR code pairing | Bot token + user ID | RPC token |
| Message limit | 4096 chars | ~4000 chars | ~4000 chars | 2000 chars | Unlimited |
| Inline buttons | Yes (inline keyboard) | No (tapback reactions) | No (list menus) | Yes (buttons + components) | Yes (React) |
| Rich formatting | Markdown | iMessage effects | Basic formatting | Embeds + Markdown | Full HTML/React |
| Voice messages | Yes | Yes | Yes | Yes | No |
| Requires server | No (long polling) | Yes (BlueBubbles macOS app) | No (direct web bridge) | No (gateway connection) | No (built-in) |
| Platform lock | None | macOS only (iMessage) | None | None | None |
| Dependency | fetch (built-in) | fetch (REST to BlueBubbles) | baileys | discord.js | Vite + React |

### Voice Message Flow

```
Voice message received (any channel)
    → Channel downloads audio attachment
    → VoiceTranscriber.transcribe(audioPath)
        → whisper CLI (local, Python) or OpenAI Whisper API (fallback)
    → Transcript text
    → AI Gateway processes as normal text message
    → Response sent back as text
```

## Data Flow

```
User sends message on any channel
  → Channel transport receives message
  → Authorization check (channel-specific allowlist)
  → tryDirectCommand() — fast path for /jobs, /status, etc.
  → If no direct match → AI Gateway:
      1. buildChatContext(message)      → pull relevant memories
      2. AI query(prompt + memory + data snapshot)
      3. extractAndSaveMemories(response) → save new facts, strip tags
      4. Format response for channel
  → Send response back to user
```

## Implementation Order

```
10.1 (Memory Extraction) ← Foundation for all channels
    ↓
10.2 (iMessage)    ┐
10.3 (WhatsApp)    ├── Can be parallel (independent extensions)
10.4 (Discord)     ┘
    ↓
10.5 (Voice Messages) ← Adds voice to all channels built above
    ↓
10.6 (Web Interface)   ← Standalone, can be parallel with 10.2-10.5
```

10.1 must come first — it creates the shared `extractAndSaveMemories()` utility and `buildChatContext()` method that all channels use. The three channel extensions (10.2-10.4) are independent. Voice messages (10.5) should come after at least one channel is built to test against. The web UI (10.6) is fully independent.

## New Packages Summary

| Package | Type | Settings Keys |
|---------|------|---------------|
| `@openorbit/ext-imessage` | Extension | `imessage.server-url`, `imessage.password`, `imessage.authorized-handles` |
| `@openorbit/ext-whatsapp` | Extension | `whatsapp.authorized-numbers` |
| `@openorbit/ext-discord` | Extension | `discord.bot-token`, `discord.authorized-user-ids` |
| `packages/web-ui` | Standalone | `web.enabled`, `web.port` |
| (core) | Shared utility | `voice.whisper-model`, `voice.enabled` |

## Success Criteria

- [ ] AI conversations remember user preferences across sessions
- [ ] `<memory>` tags never visible to users on any channel
- [ ] iMessage bot responds to messages via BlueBubbles
- [ ] WhatsApp bot responds to messages via Baileys
- [ ] Discord bot responds to messages via Discord.js
- [ ] Voice messages transcribed and processed on all channels
- [ ] Web UI loads in mobile browser with chat, jobs, and status views
- [ ] All channels support direct commands (/jobs, /status, etc.)
- [ ] All channels support natural language via AI gateway
- [ ] Only authorized users can interact on each channel
- [ ] All AI processing through whichever provider is configured (Max plan default)
- [ ] `npx vitest run` — all tests pass
- [ ] `npx electron-vite build` — build succeeds
