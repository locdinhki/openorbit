# OpenOrbit Development Roadmap

> Internal development guide. Each phase interleaves engineering hardening with feature development. Every phase leaves the app in a shippable state.

For detailed phase specs, see [docs/phases/](phases/).

## Current Status

**Phases 1–9, 11–18:** Complete
**Phases 10, 19–20:** Not started

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
| 10 | [Conversational Memory & Messaging](phases/archive/phase-10-conversational-memory/) | Not started |
| 11 | [CRM & Real Estate Intelligence](phases/archive/phase-11-crm-real-estate/) | Complete |
| 12 | [Skill System](phases/archive/phase-12-skill-system/) | Complete |
| 13 | [Skills Panel UI](phases/archive/phase-13-skills-panel-ui/) | Complete |
| 14 | [LM Studio Provider](phases/archive/phase-14-lm-studio-provider/) | Complete |
| 15 | [Deal Analysis & Reporting](phases/phase-15-deal-analysis-reporting/) | Complete |
| 16 | [Communication & Outreach](phases/archive/phase-16-communication-outreach/) | Complete |
| 17 | [Document & Data Tooling](phases/archive/phase-17-document-data-tooling/) | Complete |
| 18 | [Financial Operations](phases/archive/phase-18-financial-operations/) | Complete |
| 19 | [Portfolio & Market Intelligence](phases/phase-19-portfolio-market-intelligence/) | Not started |
| 20 | [Marketing & Business Intelligence](phases/phase-20-marketing-business-intelligence/) | Not started |

## What Works (Phase 18 final state)

- Complete Electron shell with main/preload/renderer separation
- SQLite database with WAL mode, migrations, full repository layer
- Full LinkedIn adapter (search, extraction, Easy Apply engine)
- Indeed and Upwork adapters
- AI provider registry with Claude Agent SDK, Claude API, OpenAI, Ollama, LM Studio
- Human behavior simulation (delays, typing, scrolling, idle pauses)
- Patchright-based session manager with user-data-dir profiles
- Skills-based action executor (JSON + markdown format)
- Memory system with sqlite-vec + FTS5 for learning
- Cron scheduling with node-cron, manual triggers, run history
- Config hot-reload, system tray, desktop notifications, auto-updater
- WebSocket JSON-RPC 2.0 server on localhost:18790 with token auth
- Monorepo: `packages/core`, `packages/cli`, `packages/mcp-server`, 19 extensions
- Chrome Extension Relay (Manifest V3, CDP proxy via user's real Chrome)
- Community marketplace: skills install/registry, adapter discovery
- iOS companion app (SwiftUI, QR pairing, push notifications)
- Telegram bot gateway with AI-powered chat
- MCP server bridging MCP protocol to RPC server
- Database viewer/editor with SQL console and data export/import
- GoHighLevel CRM integration (contacts, pipelines, conversations, calendars, AI chat, briefing)
- Zillow property data scraping with ARV enrichment automation
- Skill System: registry, 10 built-in skills, AI tool integration, IPC channels
- Skills Panel UI: browsable catalog, install/uninstall, custom skill creation
- LM Studio local LLM provider: OpenAI-compatible API, SSE streaming, tool calling, dynamic model discovery
- Email SMTP skill: nodemailer integration, HTML templates, merge fields, attachments
- SMS/MMS skill: Twilio integration, E.164 normalization, media attachments
- VoIP extension (ext-voip): Twilio Voice calls, recording, AI transcription, call analytics
- Financial Calculator skill: 9 real estate formulas (ROI, cap rate, DSCR, mortgage payment, etc.)
- PDF Generation skill: pdf-lib based with merge fields, key-value grids, tables, embedded images
- Chart Rendering skill: chartjs-node-canvas for server-side bar, line, pie, doughnut charts
- Deal Analyzer extension (ext-deal-analyzer): deal CRUD, comps, expenses, financial analysis, comparison, PDF export, 6 AI tools
- Spreadsheet Export skill: exceljs for xlsx/csv with formatting, formulas, multi-sheet support
- Document Generation skill: Markdown templates with {{field}} merge syntax, PDF/HTML/text output
- OCR Extraction skill: tesseract.js local OCR with structured receipt/business card extraction
- Documents extension (ext-docs): document storage, templates, e-signature integration, 16 IPC handlers
- Stripe extension (ext-stripe): payment processing, customers, subscriptions, payment links, revenue dashboard, 16 IPC handlers
- Plaid extension (ext-plaid): bank connections via Plaid Link, incremental transaction sync, account balances, 10 IPC handlers
- Invoicing extension (ext-invoicing): invoice CRUD, line items, templates, recurring scheduler, Stripe payment links, 22 IPC handlers
- Bookkeeping extension (ext-bookkeeping): AI-assisted transaction categorization, P&L/cash flow/tax reports, Plaid/Stripe import, 24 IPC handlers
