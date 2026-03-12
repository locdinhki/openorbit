# Phase 10: Device Groups + Broadcast

**Theme:** Tag-based device groups with fan-out broadcast — send one instruction to all matching devices simultaneously.

**Effort:** Low | **Depends on:** Phase 6 | **Status:** Complete

## Why This Phase

Operations like "update all Pi devices" or "run health check on home-1 nodes" require targeting multiple devices. Individual task dispatch one-by-one is tedious. Groups let you define a logical fleet segment and broadcast to it in a single API call.

## Tasks

- [x] `device_groups` table: `id`, `name`, `description`, `tag_filter` — V4 migration
- [x] Tag-based membership: devices matching `locationTag` equality belong to the group
- [x] Broadcast: `POST /api/groups/:id/broadcast` → fan-out creates one task per online member, returns `{ taskCount, tasks }`
- [x] Group REST endpoints: `GET/POST /api/groups`, `GET/DELETE /api/groups/:id`, `GET /api/groups/:id/members`
- [x] Dashboard: Groups list page (member + online counts, inline broadcast form), GroupNew create form with device preview
- [x] AI agent tools: `list_groups`, `create_group`, `broadcast_command` (18 total tools)
- [x] Build verified: main 978kB, renderer 1366kB; dashboard 284kB JS + 17kB CSS

## AI Tools (3 new, 18 total)

| Tool | Description |
|------|-------------|
| `list_groups` | List device groups with member counts |
| `create_group` | Create a group with a tag filter |
| `broadcast_command` | Broadcast an exec command to all online group members |

## Success Criteria

- [x] Group members update dynamically as device `locationTag` values change
- [x] Broadcast creates exactly one task per online group member (offline devices skipped)
- [x] Dashboard GroupNew shows device preview before saving
- [x] AI can broadcast a shell command to a group by name
