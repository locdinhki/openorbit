# 7.3: IPC + Renderer Integration

**Effort:** Low | **Status:** Complete

## Tasks

- [x] IPC channels: `ext-hive:chat-send`, `ext-hive:chat-clear` (8 total ext-hive channels now)
- [x] IPC schemas (Zod validation for both channels)
- [x] Chat state in ext-hive Zustand store: `chatMessages`, `chatLoading`, `sendChatMessage()`, `clearChat()`
- [x] IPC client methods: `ipc.chatSend(message)`, `ipc.chatClear()`

## IPC Channels

| Channel | Direction | Args | Returns |
|---------|-----------|------|---------|
| `ext-hive:chat-send` | invoke | `{ message: string }` | `string` (AI response) |
| `ext-hive:chat-clear` | invoke | `{}` | `void` |

## Success Criteria

- [x] `ext-hive:chat-send` reaches `HiveChatHandler.sendMessage()` in main process
- [x] AI response string is returned to renderer correctly
- [x] Chat state updates reactively in the Zustand store
- [x] IPC channels match the `/^[a-z-]+:[a-z-]+$/` naming rule
