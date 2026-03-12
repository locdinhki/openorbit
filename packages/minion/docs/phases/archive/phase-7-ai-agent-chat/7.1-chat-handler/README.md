# 7.1: Chat Handler (Main Process)

**Effort:** Moderate | **Status:** Complete

## Tasks

- [x] `HiveChatHandler` class in `ext-hive/src/main/ai/hive-chat-handler.ts`
  - Constructor accepts `AIService`, `() => HiveClient | null`, `SkillService`
  - In-memory message history (max 20 messages, auto-trim oldest)
  - `sendMessage(message: string): Promise<string>` — public API
  - Agentic loop: `provider.completeWithTools()` → execute tool calls → feed results back → repeat (max 10 rounds)
  - Fallback for non-tool-capable providers: prefetch device list + recent tasks into system prompt, single `chat()` call
  - `clearHistory()` — resets conversation
- [x] System prompt: fleet operator assistant, acts first explains after, safety rules (no destructive commands without confirmation, never expose API keys)
- [x] Lazy initialization on first chat message

## System Prompt Principles

- You are a fleet operator assistant managing a distributed compute network
- Prefer acting over asking — execute commands and show results
- Explain what you did after acting, not before
- For multi-device operations, iterate and aggregate results
- Never generate destructive commands (`rm -rf`, `dd`, `format`) without explicit confirmation

## Success Criteria

- [x] `sendMessage` returns a string response from the AI
- [x] Agentic loop correctly feeds tool results back for multi-step operations
- [x] History auto-trims at 20 messages
- [x] Fallback path works when provider lacks tool calling capability
