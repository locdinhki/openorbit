# OpenOrbit

**Autonomous job search and application platform.**

OpenOrbit discovers opportunities, evaluates fit with AI, and applies on your behalf — across LinkedIn, Indeed, Upwork, and more. One engine. Multiple platforms. Every device.

---

## Features

- **AI-Powered Scoring** — 4 AI providers (Claude SDK, Claude API, OpenAI, Ollama) analyze every listing, score match quality 0–100, flag red flags, and highlight strong fits
- **Easy Apply Engine** — Full LinkedIn Easy Apply automation with multi-step form detection and answer templates
- **Stealth Mode** — Human behavior simulation with random delays, typing variation, and anti-detection via Patchright
- **Memory System** — SQLite with FTS5 full-text search and vector similarity. Learns from your history
- **Answer Templates** — Store and reuse answers to common application questions. Pauses for approval on new ones
- **Extension System** — 9 extensions with hot-loading, shared services, and isolated IPC channels
- **Scheduling** — Generic scheduler with cron expressions, manual triggers, run history tracking, and push events
- **Remote Control** — Telegram, iMessage, and WhatsApp bots for AI-powered job search from any device
- **Database Tooling** — Built-in schema browser, data grid, SQL console, and export/import
- **MCP Server** — 10 tools bridging OpenOrbit to Claude Code and other MCP clients

## Supported Platforms

| Platform | Status | Capabilities |
|----------|--------|--------------|
| LinkedIn | Active | Search, extract, Easy Apply, profile scoring |
| Indeed | Active | Search, extract, apply |
| Upwork | Active | Monitor, extract, proposal generation |

## AI Providers

| Provider | Models | Features |
|----------|--------|----------|
| Claude SDK (default) | Max plan | Agent SDK, streaming, tool calling |
| Claude API | Sonnet, Opus | Streaming, tool calling, vision |
| OpenAI | GPT-4o-mini, GPT-4o, o1 | Streaming, function calling |
| Ollama | Auto-discovered local models | No API key needed |

## Ecosystem

OpenOrbit is a cross-device system — control your job search from anywhere.

- **Desktop App** — Electron 36 + React 19 with 3-panel UI, real-time dashboard, and AI chat
- **CLI** — 11 commands: `search`, `analyze`, `apply`, `schedule`, `skills`, `adapters`, `templates`, `relay`, and more
- **MCP Server** — 10 tools for job management, automation control, and monitoring via Model Context Protocol
- **Telegram Bot** — AI-powered remote control with inline keyboards and direct commands
- **iMessage Bot** — Remote job search via BlueBubbles protocol
- **WhatsApp Bot** — Remote job search via Baileys protocol
- **iOS Companion** — SwiftUI app with QR pairing, push notifications, and swipe-based job approval
- **Chrome Extension** — Relay automation through your real Chrome browser via DevTools Protocol

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
│       ├── ext-jobs/            # Job search, automation, platform adapters
│       ├── ext-db-viewer/       # Database viewer, SQL console, export/import
│       ├── ext-telegram/        # Telegram bot gateway
│       ├── ext-imessage/        # iMessage bot gateway
│       └── ext-whatsapp/        # WhatsApp bot gateway
├── mobile/                # iOS Companion (SwiftUI)
└── site/                  # Landing page
```

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
npx electron-vite build && npx electron-builder --mac

# Windows
npx electron-vite build && npx electron-builder --win

# Linux
npx electron-vite build && npx electron-builder --linux
```

### CLI

```bash
openorbit search --platform linkedin --role "Senior Engineer"
openorbit apply --auto --top 10
openorbit status
```

## Tech Stack

- **Runtime**: Electron 36 + Node.js
- **Frontend**: React 19, TypeScript, Tailwind CSS, Zustand
- **Automation**: Patchright (stealth Playwright fork)
- **AI**: Claude SDK, Claude API, OpenAI, Ollama — with provider registry and model tier routing
- **Database**: SQLite with WAL mode, FTS5, sqlite-vec
- **IPC**: 77 validated channels with Zod schemas across shell and extensions
- **RPC**: WebSocket JSON-RPC 2.0 on port 18790 with token auth
- **MCP**: Model Context Protocol server with 10 tools
- **Testing**: Vitest — 722 tests passing across 66 test files
- **Extensions**: 9 extensions with discovery, activation ordering, and shared services

## License

MIT
