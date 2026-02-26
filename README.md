# OpenOrbit

**Autonomous job search and application platform.**

OpenOrbit discovers opportunities, evaluates fit with AI, and applies on your behalf — across LinkedIn, Indeed, Upwork, and more. One engine. Multiple platforms. Every device.

---

## Features

- **AI-Powered Scoring** — Claude AI analyzes every listing, scores match quality 0–100, flags red flags, and highlights strong fits
- **Easy Apply Engine** — Full LinkedIn Easy Apply automation with multi-step form detection and answer templates
- **Stealth Mode** — Human behavior simulation with random delays, typing variation, and anti-detection measures
- **Memory System** — SQLite with FTS5 full-text search and vector similarity. Learns from your history
- **Answer Templates** — Store and reuse answers to common application questions. Pauses for approval on new ones
- **Extensible Adapters** — Pluggable platform system to add new job sites without touching core logic

## Supported Platforms

| Platform | Status | Capabilities |
|----------|--------|--------------|
| LinkedIn | Active | Search, extract, Easy Apply, profile scoring |
| Indeed | Active | Search, extract, apply |
| Upwork | Active | Monitor, extract, proposal generation |

## Ecosystem

OpenOrbit is a cross-device system — control your job search from anywhere.

- **Desktop App** — Electron + React with 3-panel UI, real-time dashboard, and Claude chat
- **CLI** — 10+ commands: `search`, `analyze`, `apply`, `skills`, `adapters`, `templates`, `relay`, and more
- **Chrome Extension** — Relay automation through your real Chrome browser via DevTools Protocol
- **iOS Companion** — SwiftUI app with QR pairing, push notifications, and swipe-based job approval

## Architecture

```
openorbit/
├── src/
│   ├── main/          # Electron main process, IPC handlers, RPC server
│   └── renderer/      # React UI, Zustand state, IPC client
├── packages/
│   ├── core/          # Business logic, adapters, AI, automation, DB
│   └── cli/           # Command-line interface
├── extension/         # Chrome Extension (Manifest V3)
├── mobile/            # iOS Companion (SwiftUI)
└── site/              # Landing page
```

## Quick Start

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Build

```bash
# macOS
pnpm build:mac

# Windows
pnpm build:win

# Linux
pnpm build:linux
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
- **AI**: Claude API (Sonnet for real-time, Opus for deep analysis)
- **Database**: SQLite with WAL mode, FTS5, sqlite-vec
- **IPC**: 48 validated channels with Zod schemas
- **RPC**: WebSocket JSON-RPC 2.0 on port 18790 with token auth
- **Testing**: Vitest — 502 tests passing

## License

MIT
