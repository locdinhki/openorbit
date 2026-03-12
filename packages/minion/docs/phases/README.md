# Open Hive + Minions — Build Phases

> See [SPEC.md](../../SPEC.md) for the full system spec.

## Phases

| # | Phase | Theme | Effort | Status |
|---|-------|-------|--------|--------|
| 1 | [Minion Agent](archive/phase-1-minion-agent/) | Binary agent: executor, hardware fingerprint, local API, config | Low | **Complete** |
| 2 | [Minimal Hive](archive/phase-2-minimal-hive/) | In-memory relay: WS auth, task queue, REST API | Low | **Complete** |
| 3 | [Persistence + Deploy](archive/phase-3-persistence-deploy/) | PostgreSQL via Drizzle, Railway deploy, Pi install | Moderate | **Complete** |
| 4 | [File Transfer](archive/phase-4-file-transfer/) | R2 upload/download for large payloads | Low | **Skipped** |
| 5 | [Controller Extension](archive/phase-5-controller-ext-hive/) | ext-hive: REST client, IPC, sidebar, task dispatch, skills | Moderate | **Complete** |
| 6 | [Web Dashboard](archive/phase-6-web-dashboard/) | Vite + React SPA served from Railway hive | Moderate | **Complete** |
| 7 | [AI Agent Chat](archive/phase-7-ai-agent-chat/) | HiveChatHandler agentic loop, HiveAgentPanel workspace | Moderate | **Complete** |
| 8 | [Task Scheduling](archive/phase-8-task-scheduling/) | schedules table, cron evaluator, dashboard + AI tools | Moderate | **Complete** |
| 9 | [Workflows](archive/phase-9-workflows/) | Sequential step executor, variable substitution, branching | Moderate | **Complete** |
| 10 | [Device Groups + Broadcast](archive/phase-10-device-groups/) | Tag-based groups, fan-out broadcast, AI tools | Low | **Complete** |
| 11 | [Monitoring + Alerts](archive/phase-11-monitoring-alerts/) | Live metrics, alert rules + Telegram notifications, sparklines | Moderate | **Complete** |
| 12 | [Minion Auto-Update](archive/phase-12-minion-auto-update/) | Version tracking, self-update instruction, dashboard Update All | Low | **Complete** |
| 13 | [Live Terminal](phase-13-live-terminal/) | xterm.js + node-pty PTY relay over WebSocket — interactive shell in browser | Large | Not started |
| 14 | [Automation](archive/phase-14-automation/) | Task templates, webhook receiver, event-driven triggers | Medium | **Complete** |
| 15 | [Observability](archive/phase-15-observability/) | WS push to dashboard, health checks, Prometheus, AI fleet report | Medium | **Complete** |
| 16 | [Platform & Access](phase-16-platform/) | Multi-user + roles, audit log, hive-ctl CLI | Medium | Not started |

## Recommended Build Order

Phase 13 (live terminal) is the highest-impact next step — it transforms the system from a task-dispatch tool into a real fleet management platform:

```
Phase 13: Live Terminal         ← step-change UX, do this first
    │
    ├── Phase 14: Automation    ← templates + webhooks + auto-remediation
    ├── Phase 15: Observability ← real-time dashboard + health checks + reports
    └── Phase 16: Platform      ← needed before sharing with others
```

## Architecture

```
Controller (MacBook / OpenOrbit)
    │  REST API (HTTPS)
    ▼
Hive (Railway — Express 5 + PostgreSQL)
    │  WebSocket (WSS, outbound from minions)
    ▼
Minions (Pi, PC, Mac Mini — dumb workers)
```

| Component | Package | Role |
|-----------|---------|------|
| Minion | `packages/minion/` | Compiled binary — executes instructions |
| Hive | `packages/hive/` | Relay + task queue + DB + dashboard SPA |
| Controller | `packages/extensions/ext-hive/` | OpenOrbit extension — AI agent + UI |
