# Phase 15: Observability

**Theme:** Full-stack visibility — real-time dashboard updates, application-layer health checks, Prometheus metrics for Grafana, and a daily AI fleet health report.

**Effort:** Medium | **Depends on:** Phase 11 (metrics + alerts) | **Status:** Not started

## Why This Phase

Phase 11 added metric collection and threshold alerts. This phase completes the observability picture:

- **Real-time** — eliminate the 10s polling delay; device status changes appear instantly
- **Application layer** — CPU/RAM metrics don't catch a dead nginx process; health checks do
- **External dashboards** — Prometheus lets existing Grafana setups consume fleet data
- **Proactive digest** — a daily AI report surfaces trends before they become incidents

---

## Part A: WebSocket Push to Dashboard

Replace polling with push. One persistent WS connection from the browser to the hive carries all state changes in real time.

### New WS Endpoint

`GET /api/ws/dashboard?token=<bearer>` — upgrades to WebSocket, authenticated.

On connect: hive sends an initial snapshot of all device statuses. After that, events push as they happen.

### Event Types (Hive → Dashboard)

| Event | Trigger | Payload |
|-------|---------|---------|
| `device.status` | Minion connects / disconnects | `{ deviceId, status, lastSeenAt }` |
| `device.metrics` | Heartbeat with metrics | `{ deviceId, metrics }` |
| `task.created` | POST /api/tasks | `{ task }` |
| `task.updated` | Task status change | `{ taskId, status, completedAt? }` |
| `alert.fired` | AlertEngine fires alert | `{ alert }` |
| `alert.resolved` | AlertEngine resolves | `{ alertId, resolvedAt }` |

### DashboardHub

```typescript
class DashboardHub {
  private clients: Set<WebSocket>
  add(ws: WebSocket): void
  remove(ws: WebSocket): void
  broadcast(event: string, payload: unknown): void
}
```

### Dashboard Changes

- Replace `setInterval` in Devices, Tasks, Alerts, Monitoring with `useLiveUpdates()` hook
- Hook opens WS, routes events to local state, reconnects with exponential backoff
- Keep manual refresh buttons for explicit reload

### Files

| File | Action |
|------|--------|
| `packages/hive/src/dashboard-hub.ts` | CREATE |
| `packages/hive/src/ws-server.ts` | EDIT — call `hub.broadcast` on device events |
| `packages/hive/src/routes.ts` | EDIT — call `hub.broadcast` on task events |
| `packages/hive/src/alert-engine.ts` | EDIT — call `hub.broadcast` on alert events |
| `packages/hive/dashboard/src/lib/use-live-updates.ts` | CREATE |
| Dashboard pages | EDIT — remove setInterval, use hook |

---

## Part B: Health Checks

Per-device HTTP or command probes that run on a timer and feed into the existing alert system.

### Why Health Checks vs Metrics

Metrics (CPU/RAM) measure resource consumption. Health checks measure application state: is nginx running? Does the API respond with 200? These are orthogonal — a device can have low CPU with a dead service.

### DB Schema

```sql
CREATE TABLE health_checks (
  id               TEXT PRIMARY KEY,
  device_id        TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  type             TEXT NOT NULL CHECK(type IN ('http', 'command')),
  url              TEXT,             -- http checks
  expected_status  INTEGER DEFAULT 200,
  expected_body    TEXT,             -- substring match, optional
  command          TEXT,             -- command checks
  expected_exit    INTEGER DEFAULT 0,
  run_from         TEXT DEFAULT 'device' CHECK(run_from IN ('hive', 'device')),
  interval_s       INTEGER NOT NULL DEFAULT 60,
  timeout_s        INTEGER NOT NULL DEFAULT 10,
  enabled          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE health_check_results (
  id          TEXT PRIMARY KEY,
  check_id    TEXT NOT NULL REFERENCES health_checks(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK(status IN ('pass', 'fail')),
  duration_ms INTEGER,
  error       TEXT,
  checked_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_hcr ON health_check_results(check_id, checked_at DESC);
```

### How Checks Run

1. Hive scheduler finds due checks every 30s
2. HTTP checks with `run_from='hive'`: hive makes the request directly
3. HTTP/command checks with `run_from='device'`: dispatch `http` or `exec` task to minion
4. Store result → update `next_run_at`
5. Fail → `alertEngine.checkHealthFail()` → alert fires
6. Pass after fail → `alertEngine.resolveHealthFail()` → alert resolves

### REST Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health-checks` | List checks (filterable by deviceId) |
| POST | `/api/health-checks` | Create a check |
| PATCH | `/api/health-checks/:id` | Update / enable / disable |
| DELETE | `/api/health-checks/:id` | Delete check |
| GET | `/api/health-checks/:id/results` | Recent history |

### Dashboard

- Health Checks page (`/health-checks`) — device, name, type, status dot (green/red), last checked
- Create form: device, type, URL or command, interval, run_from
- Expand row → last 20 results with duration and error message
- Device detail page: check status indicators at a glance

---

## Part C: Prometheus Endpoint

Standard `/metrics` output for Grafana and any Prometheus-compatible scraper.

### Metrics Exposed

```
hive_device_count{status="online"} 3
hive_device_count{status="offline"} 1
hive_task_total{status="completed"} 142
hive_task_total{status="failed"} 7
hive_device_cpu_percent{device="minion-01-pi4"} 23.5
hive_device_mem_percent{device="minion-01-pi4"} 61.2
hive_alert_active 2
hive_health_check_status{check="nginx-check",device="minion-01-pi4"} 1
```

### Implementation

```typescript
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4')
  res.send(buildPrometheusText(store, wsServer))
})
```

No auth by default. Optional `METRICS_TOKEN` env var enables bearer check.

Ship a Grafana dashboard JSON in `packages/hive/grafana/fleet-dashboard.json`.

---

## Part D: Fleet Health AI Report

Daily AI-generated summary of fleet performance delivered to Telegram and stored in the dashboard.

### Report Contents

1. Fleet status snapshot — N online, M offline, uptime %
2. Per-device metric summary — avg/peak CPU%, avg/peak RAM% over 24h
3. Alert summary — rules fired, resolution rate
4. Task performance — total, success rate, avg duration
5. Anomalies — devices significantly above 7-day baseline
6. AI observations — e.g. "Pi 4 has been >70% CPU consistently — consider offloading scraping"

### DB Schema

```sql
CREATE TABLE fleet_reports (
  id           TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  content      TEXT NOT NULL,  -- Markdown
  period_start TEXT NOT NULL,
  period_end   TEXT NOT NULL
);
```

### Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...   # required for AI generation
REPORT_TIME=08:00              # daily schedule (default 08:00 server time)
```

### REST + Dashboard

- `GET /api/reports` / `GET /api/reports/:id` / `POST /api/reports/generate`
- Reports page (`/reports`) — list with date, Markdown viewer, "Generate Now" button

---

## AI Tools (4 new)

| Tool | Description |
|------|-------------|
| `list_health_checks` | List checks with current pass/fail status |
| `create_health_check` | Configure a new probe for a device |
| `generate_fleet_report` | Trigger an immediate fleet health report |
| `get_latest_report` | Retrieve the most recent report content |

## Success Criteria

- [ ] Device status change appears in dashboard within 1s (no polling)
- [ ] Health check fails → alert fires; recovers → alert resolves
- [ ] `GET /metrics` returns valid Prometheus text; Grafana can scrape it
- [ ] Daily AI report is generated, sent to Telegram, and stored in dashboard
- [ ] Dashboard reconnects WS automatically if connection drops
