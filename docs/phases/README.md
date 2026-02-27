# OpenOrbit Development Phases

Internal development guide. Each phase interleaves engineering hardening with feature development. Every phase leaves the app in a shippable state.

## Phases

| # | Phase | Theme | Effort | Status |
|---|-------|-------|--------|--------|
| 1 | [Solid Foundation](archive/phase-1-solid-foundation/) | Testing, IPC validation, error handling, CI/CD, DB hardening | Moderate | **Complete** |
| 2 | [Stealth & Resilience](archive/phase-2-stealth-resilience/) | Anti-detection, application engine, observability | High | **Complete** |
| 3 | [Autonomous Intelligence](archive/phase-3-autonomous-intelligence/) | Learning, scheduling, AI resilience | Moderate | **Complete** |
| 4 | [Platform Expansion](archive/phase-4-platform-expansion/) | Multi-platform, desktop integration, auto-update | High | **Complete** |
| 5 | [Architecture Evolution](archive/phase-5-architecture-evolution/) | Decoupling for distribution, CLI, SDK | Very High | **Complete** |
| 6 | [Distributable Platform](archive/phase-6-distributable-platform/) | Community, cross-device, marketplace | Very High | **Complete** |
| 7 | [AI Remote Access](archive/phase-7-ai-remote-access/) | Agent SDK, MCP server, Telegram bot, remote access | High | **Complete** |
| 8 | [Database Tooling](archive/phase-8-database-tooling/) | Built-in DB viewer/editor, SQL console, data export/import | Moderate | **Complete** |
| 9 | [Schedule Runtime](archive/phase-9-schedule-runtime/) | Manual triggers, run history, animation system, browser cleanup | Moderate | **Complete** |
| 10 | [Conversational Memory & Messaging](phase-10-conversational-memory/) | Memory extraction, iMessage, WhatsApp, Discord, voice messages, web UI | High | Not started |
| 11 | [CRM & Real Estate Intelligence](archive/phase-11-crm-real-estate/) | GoHighLevel CRM, Zillow property data, AI-powered CRM chat, ARV enrichment | Very High | **Complete** |
| 12 | [Skill System](phase-12-skill-system/) | Generic reusable capabilities any extension or AI can invoke | Moderate | **In Progress** |

## After Each Phase

| After Phase | OpenOrbit Is... |
|-------------|----------------|
| 1 | A reliable, tested, CI-gated LinkedIn extraction tool |
| 2 | A stealthy LinkedIn job searcher and applicant with anti-detection |
| 3 | A self-scheduling, learning automation agent |
| 4 | A multi-platform job automation suite with desktop integration |
| 5 | A developer platform with CLI, SDK, and WebSocket API |
| 6 | A community-driven, cross-device job automation ecosystem |
| 7 | An AI-controlled job automation agent accessible from any phone |
| 8 | A self-inspectable platform with built-in database tooling |
| 9 | A schedule system with runtime feedback, run history, and polished animations |
| 10 | An AI assistant that remembers preferences, understands voice, and is reachable from iMessage, WhatsApp, Discord, or any browser |
| 11 | A CRM-integrated platform with GoHighLevel contacts, pipelines, conversations, AI chat, and automated Zillow ARV enrichment |
| 12 | A composable platform with generic skills (calculator, transcription, formatting) any extension or AI chat can invoke |

## Phase Dependency Map

```
Phase 1: Solid Foundation
    |
    v
Phase 2: Stealth & Resilience
    |
    v
Phase 3: Autonomous Intelligence
    |
    v
Phase 4: Platform Expansion
    |
    v
Phase 5: Architecture Evolution
    |
    v
Phase 6: Distributable Platform
    |
    v
Phase 7-11: (parallel tracks after Phase 6)
    |
    v
Phase 12: Skill System
```

## Critical Files (touched across multiple phases)

| File | Phases | Role |
|------|--------|------|
| `src/main/ipc-handlers.ts` | 1, 2, 3, 4, 5 | Central IPC dispatch — Zod validation, new channels, WebSocket migration |
| `src/main/automation/session-manager.ts` | 2, 5 | Browser lifecycle — rewritten for user-data-dir, abstracted for core extraction |
| `src/main/ai/claude-service.ts` | 3, 5 | AI gateway — key rotation, failover, usage tracking, dependency inversion |
| `src/main/platforms/linkedin/linkedin-applicator.ts` | 2 | 2-line stub → full Easy Apply engine |
| `src/shared/types.ts` | All | Domain types extended every phase |
| `src/main/db/database.ts` | 1, 2, 3 | New migrations for metrics, memory, schedules, API usage |
| `package.json` | All | New dependencies every phase |

## OpenClaw Analysis Cross-Reference

Items from `docs/research/openclaw-analysis.md` mapped to roadmap phases:

| OpenClaw Insight | Section | Roadmap Phase |
|-----------------|---------|---------------|
| Patchright (drop-in Playwright replacement) | Section 3, Rec #1 | Phase 2.1 |
| User-data-dir sessions | Section 3, Rec #2 | Phase 2.2 |
| Config hot-reload | Section 4F | Phase 3.4 |
| API key rotation | Section 4E | Phase 3.1 |
| Cron scheduling | Section 4D | Phase 3.3 |
| Memory system (sqlite-vec + FTS5) | Section 4C | Phase 3.2 |
| Multi-model failover | Section 4E | Phase 3.1 |
| Skills format (markdown) | Section 4G | Phase 4.3 |
| WebSocket architecture | Section 4H | Phase 5.1 |
| Chrome Extension Relay | Section 4I | Phase 6.1 |
| Monorepo + npm | Section 5 | Phase 5.2 |
| Mobile companion | Section 4L | Phase 6.2 |
| Community marketplace | Section 4M | Phase 6.3 |
| Markdown personality files (SOUL.md, MEMORY.md) | Section 7 | Phase 3.2 |
| Brain/body separation | Section 6 | Phase 5.2 |
