# Phase 2: Minimal Hive

**Theme:** Validate end-to-end communication — in-memory relay that connects controller to minion over WebSocket.

**Effort:** Low | **Depends on:** Phase 1 | **Status:** Complete

## Why This Phase

Prove the communication model before adding a database. Everything lives in memory so iteration is fast. The goal: a controller can POST a task to the hive REST API, the hive forwards it to a connected minion over WebSocket, and the result comes back.

## Tasks

- [x] Express server + `ws` server in single entry point
- [x] In-memory device registry (no DB yet)
- [x] In-memory task queue
- [x] WS auth (API key check) + hardware ID adoption on first connect
- [x] REST: `POST /api/tasks`, `GET /api/tasks/:id`, `GET /api/devices`, `POST /api/devices`
- [x] Minion WS client with auto-reconnect (exponential backoff: 5s → 10s → 30s → 60s cap)
- [x] End-to-end test: controller → hive → minion → result → controller
- [x] Run hive locally on MacBook first

## WebSocket Protocol

```
Minion → Hive (auth):
{ "type": "auth", "apiKey": "xxx", "hardwareId": "abc", "deviceInfo": {...} }

Hive → Minion (instruction):
{ "messageId": "msg-001", "taskId": "task-abc", "instruction": { "type": "exec", "command": "df -h" } }

Minion → Hive (result):
{ "messageId": "msg-001", "taskId": "task-abc", "status": "completed", "result": { "exitCode": 0, ... } }

Minion → Hive (heartbeat every 30s):
{ "type": "heartbeat" }
```

## Success Criteria

- [x] Minion connects to hive, authenticates, and enters instruction loop
- [x] Task dispatched via REST reaches the correct minion over WS
- [x] Result returned by minion is accessible via `GET /api/tasks/:id`
- [x] Minion auto-reconnects after intentional disconnect
- [x] End-to-end round trip works on MacBook (localhost hive + local minion)
