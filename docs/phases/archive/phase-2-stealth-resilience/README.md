# Phase 2: Stealth & Resilience

**Theme:** Make automation harder to detect and more resilient to failures. Ship anti-detection upgrades, the application engine, and core UI.

**Effort:** High | **Depends on:** Phase 1 | **Status:** Complete

## Why This Phase

With tests and CI in place, we can safely rewrite the session manager and build the application engine — the two highest-impact changes. Patchright and user-data-dir eliminate the top detection vectors identified in the OpenClaw analysis.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 2.1 | [Patchright Integration](2.1-patchright-integration/) | Minimal | Drop-in Playwright replacement, removes #1 detection vector |
| 2.2 | [User-Data-Dir Sessions](2.2-user-data-dir-sessions/) | Moderate | Persistent Chrome profiles instead of storageState |
| 2.3 | [Rate Limiter + Circuit Breaker](2.3-rate-limiter-circuit-breaker/) | Low | Implement rate-limiter.ts stub, add circuit breaker |
| 2.4 | [LinkedIn Easy Apply](2.4-linkedin-easy-apply/) | High | Full application engine from linkedin-applicator.ts stub |
| 2.5 | [Core UI Stubs](2.5-core-ui-stubs/) | Moderate | Jobs, Chat, Application, Browser UI components |
| 2.6 | [Structured Logging](2.6-structured-logging/) | Low | File-based NDJSON logs, session metrics |

## Success Criteria

- [x] `Runtime.enable` no longer sent (Patchright)
- [x] LinkedIn sessions survive app restarts without re-login
- [x] Automation pauses automatically when rate limits are hit
- [x] 3 consecutive failures trip the circuit breaker
- [x] Can complete a LinkedIn Easy Apply application end-to-end
- [x] Custom questions pause for review via IPC pause-question flow
- [x] Application and Dashboard UI components are functional (7 components)
- [x] Logs persist to files as JSON lines with 7-day retention
