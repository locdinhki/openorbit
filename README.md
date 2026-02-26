# OpenOrbit

**Autonomous job search, CRM intelligence, and application platform.**

OpenOrbit discovers opportunities, evaluates fit with AI, manages your CRM pipeline, and applies on your behalf — across LinkedIn, Indeed, Upwork, and more. Control everything from your desktop, phone, or any messaging app.

[Extensions Guide](docs/extensions.md) · [Roadmap](docs/roadmap.md)

---

## Features

### Job Search & Applications

- **Multi-Platform Search** — LinkedIn, Indeed, and Upwork with platform-specific adapters
- **AI-Powered Scoring** — 4 AI providers analyze every listing, score match quality 0–100, flag red flags
- **Easy Apply Engine** — Full LinkedIn Easy Apply automation with multi-step form detection and answer templates
- **Stealth Mode** — Human behavior simulation via Patchright with random delays, typing variation, and anti-detection
- **Scheduling** — Cron-based extraction runs with manual triggers, run history, and push events

### CRM & Real Estate Intelligence

- **GoHighLevel Integration** — Full CRM sync: contacts, pipelines, opportunities, conversations, calendars
- **AI CRM Assistant** — Chat with your CRM data using 6 agentic tools (contacts, deals, calendars, conversations)
- **ARV Enrichment** — Automated Zillow Zestimate lookup for pipeline contacts with cache-first strategy
- **Daily Briefings** — AI-generated summaries of today's events, deals, and follow-ups

### AI & Intelligence

- **4 AI Providers** — Claude SDK (Max plan, $0), Claude API, OpenAI, Ollama (local, $0)
- **Provider Registry** — Automatic failover, key rotation, model tier routing (fast / standard / premium)
- **Memory System** — SQLite with FTS5 full-text search and sqlite-vec vector similarity

### Remote Control

- **5 Messaging Gateways** — Telegram, Discord, iMessage, WhatsApp, and MCP
- **Natural Language** — Ask questions in plain English from any messaging app via Claude Agent SDK
- **Voice Messages** — Send voice notes, get text responses (via OpenAI Whisper transcription)
- **Direct Commands** — `/jobs`, `/status`, `approve 1` for instant actions without AI

### Developer Tools

- **Database Viewer** — Schema browser, data grid with inline editing, SQL console, CSV/JSON import/export
- **MCP Server** — 10 tools bridging OpenOrbit to Claude Code and other MCP clients
- **Extension System** — 12 extensions with discovery, activation ordering, isolated IPC, and shared services
- **140 IPC Channels** — All validated with Zod schemas across shell and extensions

---

## Ecosystem

OpenOrbit is a cross-device system — control your job search from anywhere.

```
  Telegram / Discord / iMessage / WhatsApp / MCP Client
                        │
                        ▼
         ┌──────────────────────────────┐
         │        OpenOrbit Shell       │
         │   Electron + React + SQLite  │
         │    ws://127.0.0.1:18790      │
         └──────────────┬───────────────┘
                        │
         ┌──────────────┼──────────────┐
         │              │              │
         ▼              ▼              ▼
    Desktop App     CLI Tool      MCP Server
    (3-panel UI)   (commands)     (10 tools)
         │
         ▼
    iOS Companion
     (SwiftUI)
```

| Surface | Description |
|---------|-------------|
| **Desktop App** | Electron 39 + React 19 with 3-panel UI, dashboard, and AI chat |
| **CLI** | `search`, `analyze`, `apply`, `schedule`, `skills`, `adapters`, `templates`, and more |
| **MCP Server** | 10 tools for job management and automation via Model Context Protocol |
| **Telegram Bot** | Inline keyboards, slash commands, natural language, voice |
| **Discord Bot** | Rich embeds, color-coded status, approve/reject buttons, slash commands |
| **iMessage Bot** | BlueBubbles bridge for macOS native messaging |
| **WhatsApp Bot** | Baileys protocol with QR pairing and auto-reconnect |
| **iOS Companion** | SwiftUI app with QR pairing, push notifications, and swipe-based job approval |
| **Chrome Extension** | Relay automation through your real Chrome browser via DevTools Protocol |

---

## Quick Start

### Install

```bash
npm install
```

### Development

```bash
npx electron-vite dev
```

### Build

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

### CLI

```bash
openorbit search --platform linkedin --role "Senior Engineer"
openorbit apply --auto --top 10
openorbit status
```

---

## Supported Platforms

| Platform | Search | Apply | Status |
|----------|--------|-------|--------|
| LinkedIn | Yes | Yes (Easy Apply) | Active |
| Indeed | Yes | Yes | Active |
| Upwork | Yes | Yes (Proposals) | Active |
| Dice | — | — | Schema-ready |
| Wellfound | — | — | Schema-ready |
| Glassdoor | — | — | Schema-ready |

## AI Providers

| Provider | Models | Features | Cost |
|----------|--------|----------|------|
| Claude SDK (default) | Haiku, Sonnet, Opus | Streaming, tool calling | $0 (Max plan) |
| Claude API | Haiku, Sonnet, Opus | Streaming, tool calling, vision | Per-token |
| OpenAI | GPT-4o-mini, GPT-4o, o1 | Streaming, function calling | Per-token |
| Ollama | Auto-discovered local models | Streaming | $0 (local) |

---

## Architecture

```
openorbit/
├── src/
│   ├── main/              # Electron shell, IPC handlers, RPC server, tray
│   ├── preload/           # Context bridge
│   └── renderer/          # React UI, Zustand state, shell layout
├── packages/
│   ├── core/              # Business logic, AI, automation, DB, scheduler
│   ├── cli/               # Command-line interface
│   ├── mcp-server/        # MCP protocol bridge to RPC server
│   └── extensions/
│       ├── ext-ai-claude-sdk/   # Claude Agent SDK provider (default)
│       ├── ext-ai-claude/       # Claude/Anthropic API provider
│       ├── ext-ai-openai/       # OpenAI provider
│       ├── ext-ai-ollama/       # Ollama local LLM provider
│       ├── ext-db-viewer/       # Database viewer, SQL console, export/import
│       ├── ext-discord/         # Discord bot gateway
│       ├── ext-ghl/             # GoHighLevel CRM + ARV enrichment
│       ├── ext-imessage/        # iMessage bot gateway (BlueBubbles)
│       ├── ext-jobs/            # Job search, automation, platform adapters
│       ├── ext-telegram/        # Telegram bot gateway
│       ├── ext-whatsapp/        # WhatsApp bot gateway (Baileys)
│       └── ext-zillow/          # Zillow property data scraper
├── mobile/                # iOS Companion (SwiftUI)
└── site/                  # Landing page
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Electron 39 + Node.js |
| **Frontend** | React 19, TypeScript, Tailwind CSS 4, Zustand |
| **Automation** | Patchright (stealth Playwright fork) |
| **AI** | Claude SDK, Claude API, OpenAI, Ollama — provider registry with model tier routing |
| **Database** | SQLite with WAL mode, FTS5 full-text search, sqlite-vec vectors |
| **IPC** | ~140 validated channels with Zod schemas across shell and 12 extensions |
| **RPC** | WebSocket JSON-RPC 2.0 on port 18790 with token auth |
| **MCP** | Model Context Protocol server with 10 tools |
| **Testing** | Vitest — 79 test files |
| **Extensions** | 12 extensions with discovery, activation ordering, and shared services |

---

## Remote Access (Tailscale)

Makes the RPC server accessible from your phone when away from home using Tailscale's encrypted mesh VPN.

1. Install Tailscale on your Mac and phone
2. Sign in with the same account on both
3. Set `rpc.bind-host` to `0.0.0.0` in OpenOrbit settings
4. Restart — the RPC server binds to all interfaces

OpenOrbit auto-detects the tailnet IP and includes it in the pairing QR code. All traffic encrypted via WireGuard. No public internet exposure.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Extensions Guide](docs/extensions.md) | Every extension: setup, IPC channels, AI tools, configuration |
| [Roadmap](docs/roadmap.md) | Development phases and planned features |

---

## License

MIT
