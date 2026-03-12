# 7.2: Hive Tools (AI Tool Definitions)

**Effort:** Low | **Status:** Complete

## Tasks

- [x] `HIVE_TOOLS: AIToolDefinition[]` in `ext-hive/src/main/ai/hive-tools.ts` (8 tools)
- [x] Tools: `list_devices`, `get_device`, `exec_command`, `read_file`, `write_file`, `http_request`, `list_tasks`, `get_task`
- [x] Tool dispatch: switch on name, call HiveClient or `dispatchAndPoll` helper
- [x] Combined tools via `getCombinedTools(HIVE_TOOLS, skillService)` — merges hive tools with OpenOrbit skill tools

## dispatchAndPoll Helper

Reuses the polling strategy from Phase 5 skills:
1. `HiveClient.createTask({ targetDevice, instruction })`
2. Poll `HiveClient.getTask(id)` every 2s
3. Return when status is `completed` / `failed` / `timeout`
4. Max poll time = instruction timeout + 30s buffer, default 5 minutes

## Success Criteria

- [x] All 8 tool definitions have correct JSON Schema parameter specs
- [x] Tool dispatch correctly routes to the matching HiveClient method
- [x] `exec_command` blocks until the task completes on the remote device
- [x] Combined tools include both hive tools and registered OpenOrbit skills
