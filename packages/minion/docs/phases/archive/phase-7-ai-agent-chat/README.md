# Phase 7: AI Agent Chat

**Theme:** Conversational AI interface inside ext-hive. The user talks naturally ("check disk space on all minions") and the AI orchestrates hive operations using tool calling. Follows the established chat handler pattern from ext-ghl.

**Effort:** Moderate | **Depends on:** Phase 5 | **Status:** Complete

## Why This Phase

Manual task dispatch (Phase 5) requires knowing which device to target and what exact command to run. The AI agent removes that friction: it figures out device selection, chains multiple operations, and summarizes results in plain English.

## Subphases

| # | Subphase | Description |
|---|----------|-------------|
| 7.1 | [Chat Handler](7.1-chat-handler/) | HiveChatHandler class with agentic loop, history management, fallback |
| 7.2 | [Hive Tools](7.2-hive-tools/) | 8 AI tool definitions backed by HiveClient methods |
| 7.3 | [IPC + Renderer Integration](7.3-ipc-renderer/) | 2 IPC channels, Zustand chat state, IPC client methods |
| 7.4 | [Agent Chat UI](7.4-agent-chat-ui/) | HiveAgentPanel workspace with suggested prompts and thinking indicator |

## Architecture

```
HiveAgentPanel (renderer)
    │ ext-hive:chat-send
    ▼
HiveChatHandler (main process)
    │ completeWithTools() loop (max 10 rounds)
    ├── list_devices    → HiveClient.listDevices()
    ├── exec_command    → dispatchAndPoll(exec instruction)
    ├── read_file       → dispatchAndPoll(read instruction)
    ├── write_file      → dispatchAndPoll(write instruction)
    ├── http_request    → dispatchAndPoll(http instruction)
    ├── list_tasks      → HiveClient.listTasks()
    └── get_task        → HiveClient.getTask()
```

## Tools (8 total)

| Tool | Description |
|------|-------------|
| `list_devices` | All devices with status + hardware |
| `get_device` | Single device detail |
| `exec_command` | Shell command via dispatch+poll |
| `read_file` | File read via dispatch+poll |
| `write_file` | File write via dispatch+poll |
| `http_request` | HTTP request via dispatch+poll |
| `list_tasks` | Recent tasks (filterable) |
| `get_task` | Task detail + result |

## Build Output

main 969kB (+11kB), renderer 1365kB (+8kB) vs Phase 6 baseline.
