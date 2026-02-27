# OpenOrbit Development Roadmap

> Internal development guide. Each phase interleaves engineering hardening with feature development. Every phase leaves the app in a shippable state.

For detailed phase specs, see [docs/phases/](phases/).

## Current Status

**Phases 1–9, 11–12:** Complete
**Phases 10, 13–14:** Not started

| # | Phase | Status |
|---|-------|--------|
| 1 | [Solid Foundation](phases/archive/phase-1-solid-foundation/) | Complete |
| 2 | [Stealth & Resilience](phases/archive/phase-2-stealth-resilience/) | Complete |
| 3 | [Autonomous Intelligence](phases/archive/phase-3-autonomous-intelligence/) | Complete |
| 4 | [Platform Expansion](phases/archive/phase-4-platform-expansion/) | Complete |
| 5 | [Architecture Evolution](phases/archive/phase-5-architecture-evolution/) | Complete |
| 6 | [Distributable Platform](phases/archive/phase-6-distributable-platform/) | Complete |
| 7 | [AI Remote Access](phases/archive/phase-7-ai-remote-access/) | Complete |
| 8 | [Database Tooling](phases/archive/phase-8-database-tooling/) | Complete |
| 9 | [Schedule Runtime](phases/archive/phase-9-schedule-runtime/) | Complete |
| 10 | [Conversational Memory & Messaging](phases/phase-10-conversational-memory/) | Not started |
| 11 | [CRM & Real Estate Intelligence](phases/archive/phase-11-crm-real-estate/) | Complete |
| 12 | [Skill System](phases/phase-12-skill-system/) | Complete |
| 13 | [Skills Panel UI](phases/phase-13-skills-panel-ui/) | Not started |
| 14 | [LM Studio Provider](phases/phase-14-lm-studio-provider/) | Not started |

## What Works (Phase 12 final state)

- Complete Electron shell with main/preload/renderer separation
- SQLite database with WAL mode, migrations, full repository layer
- Full LinkedIn adapter (search, extraction, Easy Apply engine)
- Indeed and Upwork adapters
- AI provider registry with Claude Agent SDK, Claude API, OpenAI, Ollama
- Human behavior simulation (delays, typing, scrolling, idle pauses)
- Patchright-based session manager with user-data-dir profiles
- Skills-based action executor (JSON + markdown format)
- Memory system with sqlite-vec + FTS5 for learning
- Cron scheduling with node-cron, manual triggers, run history
- Config hot-reload, system tray, desktop notifications, auto-updater
- WebSocket JSON-RPC 2.0 server on localhost:18790 with token auth
- Monorepo: `packages/core`, `packages/cli`, `packages/mcp-server`, 9 extensions
- Chrome Extension Relay (Manifest V3, CDP proxy via user's real Chrome)
- Community marketplace: skills install/registry, adapter discovery
- iOS companion app (SwiftUI, QR pairing, push notifications)
- Telegram bot gateway with AI-powered chat
- MCP server bridging MCP protocol to RPC server
- Database viewer/editor with SQL console and data export/import
- GoHighLevel CRM integration (contacts, pipelines, conversations, calendars, AI chat, briefing)
- Zillow property data scraping with ARV enrichment automation
- Skill System: registry, 3 built-in skills (calculator, voice transcribe, data formatter), AI tool integration, IPC channels
- 51 skill system tests, build: main 675kB, preload 3kB, renderer 1270kB
