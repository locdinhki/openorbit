# 6.3: Task Dispatch + History

**Effort:** Moderate | **Status:** Complete

## Tasks

- [x] Dispatch page (`/tasks/new`) — device selector, instruction type (exec/read/write/http), dynamic form fields, priority selector
- [x] Submit → `POST /api/tasks`, redirect to task detail page
- [x] Task list page (`/tasks`) — table with ID (truncated), device, type, status badge, priority, created at
- [x] Filters: status dropdown, device dropdown
- [x] Task detail page (`/tasks/:id`) — instruction JSON, result (stdout/stderr or file content), duration
- [x] Auto-poll running tasks every 2s until `completed` / `failed` / `timeout`

## Dynamic Form Fields

| Instruction Type | Fields |
|-----------------|--------|
| `exec` | command (textarea), cwd (optional), timeout ms (optional) |
| `read` | path, encoding (optional) |
| `write` | path, content (textarea), mode (optional) |
| `http` | method, url, headers (JSON textarea), body (textarea) |

## Success Criteria

- [x] Dispatch form correctly assembles instruction JSON for all 4 types
- [x] Submitted task shows in task list immediately
- [x] Running task detail polls until completion and displays result
- [x] Task filters work (status + device) without page reload
