# Phase 8: Task Scheduling

**Theme:** Cron-based task scheduling — define recurring instructions per device, run automatically on schedule, manage from dashboard and AI chat.

**Effort:** Moderate | **Depends on:** Phase 6 + Phase 7 | **Status:** Complete

## Why This Phase

One-off task dispatch (Phase 5) covers ad-hoc work, but many minion jobs are recurring: health checks every hour, backups every night, scrapes on a schedule. This phase adds a cron evaluator to the hive and a full schedule CRUD UI.

## Tasks

- [x] `schedules` table in hive PostgreSQL: `id`, `device_id`, `instruction` (JSONB), `cron_expression`, `enabled`, `last_run_at`, `next_run_at`, `created_at`
- [x] Cron evaluator in hive server — checks due schedules every 60s, creates + dispatches tasks automatically
- [x] REST endpoints: `GET/POST /api/schedules`, `GET/PATCH/DELETE /api/schedules/:id`
- [x] Dashboard UI: schedule list (`/schedules`), create form (`/schedules/new`), enable/disable toggle, delete
- [x] ext-hive: 4 IPC channels + schedule methods in HiveClient (12 total channels)
- [x] AI agent tools: `create_schedule`, `list_schedules`, `delete_schedule` (11 total tools)
- [x] Build verified: main 975kB, preload 3.5kB, renderer 1366kB; dashboard 263kB JS + 14kB CSS

## IPC Channels (4 new)

| Channel | Purpose |
|---------|---------|
| `ext-hive:list-schedules` | Fetch all schedules |
| `ext-hive:create-schedule` | Create a new schedule |
| `ext-hive:update-schedule` | Enable/disable or update |
| `ext-hive:delete-schedule` | Remove a schedule |

## AI Tools (3 new, 11 total)

| Tool | Description |
|------|-------------|
| `list_schedules` | List all schedules with next run time |
| `create_schedule` | Create a cron schedule for a device |
| `delete_schedule` | Remove a schedule by ID |

## Success Criteria

- [x] Cron evaluator fires tasks at correct intervals
- [x] Missed runs (while hive was offline) do not pile up — next_run_at advances
- [x] Enable/disable toggle takes effect on next evaluator tick
- [x] Dashboard schedule list shows next run time in relative format
- [x] AI can create and list schedules via tool calling
