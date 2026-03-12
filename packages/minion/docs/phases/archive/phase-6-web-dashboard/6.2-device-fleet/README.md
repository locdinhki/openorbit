# 6.2: Device Fleet View

**Effort:** Low | **Status:** Complete

## Tasks

- [x] Device list page (`/devices`) — table with name, status badge (online/offline), type, hardware summary, location tag, last seen (relative time)
- [x] Auto-refresh every 10s (polling `GET /api/devices`)
- [x] Click device name → detail page: full hardware info (JSON tree), capabilities, recent tasks
- [x] Online/offline counts displayed in header

## Components

| Component | Purpose |
|-----------|---------|
| `Devices.tsx` | Device table page |
| `DeviceDetail.tsx` | Single device detail view |
| `StatusBadge.tsx` | Online/offline/busy badge |

## Success Criteria

- [x] Device list loads and auto-refreshes every 10s
- [x] Status badge accurately reflects minion heartbeat state
- [x] Hardware summary shows platform, arch, and RAM
- [x] Device detail shows full `hardwareInfo` JSONB and recent tasks
