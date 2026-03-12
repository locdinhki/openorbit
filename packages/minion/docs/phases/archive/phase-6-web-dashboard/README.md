# Phase 6: Web Dashboard

**Theme:** A lightweight React SPA served directly from the hive Express server on Railway. Fleet visibility and task management from any browser — no OpenOrbit desktop app required.

**Effort:** Moderate | **Depends on:** Phase 3 | **Status:** Complete

## Why This Phase

The hive REST API is functional but requires curl or a client app to interact with. A browser-based dashboard provides zero-install access to device status, task dispatch, and result viewing from any machine on the network.

## Subphases

| # | Subphase | Description |
|---|----------|-------------|
| 6.1 | [Build Pipeline + Static Serving](6.1-build-pipeline/) | Vite project scaffold, Express static serving, SPA fallback, auth gate |
| 6.2 | [Device Fleet View](6.2-device-fleet/) | Device table with status badges, hardware summary, auto-refresh, detail page |
| 6.3 | [Task Dispatch + History](6.3-task-dispatch/) | Dispatch form, task list with filters, task detail with auto-poll |
| 6.4 | [Health + Overview](6.4-health-overview/) | Home page with fleet summary, task stats, hive uptime |

## Architecture

```
packages/hive/dashboard/     ← Vite + React + Tailwind source
    │
    │ npm run build:dashboard
    ▼
packages/hive/dist/dashboard/ ← built static assets
    │
    │ Express static middleware
    ▼
https://hive.openorbit.ai/   ← served to browser
```

Express SPA fallback: all non-`/api/` and non-`/minion/` routes serve `index.html`.

## Auth

- Login page with single password field
- Token validated against `CONTROLLER_API_KEY` env var
- Stored in `localStorage`, sent as `Authorization: Bearer` on all API calls
- Stateless — no server-side sessions

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Fleet summary: device counts, task stats, hive uptime |
| `/devices` | Device table: name, status, type, hardware, location, last seen |
| `/devices/:id` | Device detail: hardware info, recent tasks |
| `/tasks` | Task list: filterable by status and device |
| `/tasks/new` | Dispatch form: device selector, instruction type, dynamic fields |
| `/tasks/:id` | Task detail: instruction, result, duration |
| `/login` | Auth gate |

## Build Output

- Dashboard: 257kB JS + 14kB CSS (final: 284kB JS + 17kB CSS after later phases)
- No significant impact on Railway memory footprint (static files)
