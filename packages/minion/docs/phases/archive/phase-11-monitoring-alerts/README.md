# Phase 11: Monitoring + Alerts

**Theme:** Live CPU/RAM metrics from every heartbeat, time-series storage, configurable alert rules with Telegram notifications, and sparkline dashboard.

**Effort:** Moderate | **Depends on:** Phase 6 | **Status:** Complete

## Why This Phase

Device status (online/offline) is a binary signal. Real operations need continuous visibility: is the Pi overloaded? Is RAM pressure climbing before a job fails? Are devices going offline unexpectedly? This phase adds metric collection, threshold alerts, and visual sparklines.

## Tasks

- [x] Minion metrics collector: `cpuPercent` (loadavg/cores), `memPercent` (os.freemem/totalmem), `memUsedMb`, `memTotalMb` — reported in every heartbeat
- [x] `device_metrics` table (30s granularity, auto-prune after 7 days) — V5 migration
- [x] Alert rules: configurable thresholds (`cpu > X%`, `mem > X%`, `offline`) — per-device or global (null deviceId)
- [x] `alerts` table: `rule_id`, `device_id`, `triggered_at`, `resolved_at`, `notified` — auto-resolve when metric drops below threshold
- [x] Notification channel: Telegram Bot API via `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` env vars
- [x] Hourly `store.pruneMetrics()` job in hive index.ts
- [x] REST endpoints: `GET /api/metrics/:deviceId`, `GET/POST/DELETE /api/alert-rules`, `GET /api/alerts`, `POST /api/alerts/:id/resolve`
- [x] Dashboard: Monitoring page (sparklines + metric bars per device), Alert Rules page (create/delete), Alerts page (active/resolved toggle, manual resolve)
- [x] AI agent tools: `get_device_metrics`, `list_alerts` (20 total tools)
- [x] Fixed hardware column "?" bug: dashboard now reads nested `hw.memory.totalMb` correctly

## AlertEngine

```typescript
// packages/hive/src/alert-engine.ts
class AlertEngine {
  checkMetrics(deviceId, deviceName, metrics)  // fires cpu/mem alerts
  checkOffline(deviceId, deviceName)           // fires offline alert
  resolveOffline(deviceId, deviceName)         // resolves on reconnect
  sendTelegram(text)                           // Bot API notification
}
```

Alert rules with `deviceId = NULL` are global — apply to all devices. Per-device rules take precedence.

## Sparkline Component

Pure SVG, no chart library dependency. Props: `values`, `width`, `height`, `color`, `max`.

## AI Tools (2 new, 20 total)

| Tool | Description |
|------|-------------|
| `get_device_metrics` | Fetch recent CPU/RAM metrics for a device |
| `list_alerts` | List active or resolved alerts (filterable by device) |

## Success Criteria

- [x] CPU and RAM metrics appear in hive DB within 30s of minion connecting
- [x] Alert fires and Telegram message sent when threshold is crossed
- [x] Alert auto-resolves when metric drops below threshold
- [x] Offline alert fires after heartbeat timeout; resolves on reconnect
- [x] Monitoring page sparklines render live CPU/RAM history
- [x] 7-day prune job keeps `device_metrics` table from growing unbounded
