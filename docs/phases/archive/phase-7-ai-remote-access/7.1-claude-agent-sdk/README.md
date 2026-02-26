# 7.1: Claude Agent SDK Provider

**Effort:** High | **Status:** Complete

## Background

The current `ext-ai-claude` extension uses the Anthropic API (`@anthropic-ai/sdk`) which requires a separate API key and per-token billing. Since OpenOrbit runs exclusively on the user's personal Mac, we can leverage the Claude Max plan subscription through the official Agent SDK (`@anthropic-ai/claude-agent-sdk`), which Anthropic explicitly permits for local development.

This provides the same Claude models (Haiku, Sonnet, Opus) at zero additional cost.

## How It Works

```
Existing consumers (ChatHandler, JobAnalyzer, AnswerGenerator)
    |
    |-- AIService facade (unchanged)
    |       |
    |       |-- ext-ai-claude-sdk (NEW, default)
    |       |       |-- Uses @anthropic-ai/claude-agent-sdk query()
    |       |       |-- Auth: inherits Max plan from Claude Code login
    |       |       |-- No API key required
    |       |
    |       |-- ext-ai-claude (existing, fallback)
    |               |-- Uses @anthropic-ai/sdk
    |               |-- Requires API key
```

## Tasks

### Extension Scaffold
- [x] Create `packages/extensions/ext-ai-claude-sdk/` with standard structure
- [x] `package.json` with `openorbit` manifest (`id: ext-ai-claude-sdk`, `activationEvents: ["onStartup"]`)
- [x] Register as preloaded module in shell bootstrap (`src/main/index.ts`)

### AIProvider Implementation (`claude-sdk-provider.ts`)
- [x] `complete(request)`: Single-turn via `query()` with `maxTurns: 1`, no tools
- [x] `chat(request)`: Multi-turn by formatting message history into prompt + session resume
- [x] `stream(request, onChunk)`: Streaming via `includePartialMessages: true`
- [x] `completeWithTools(request)`: Tool calling via `createSdkMcpServer()` + in-process MCP tools
- [x] `isConfigured()`: Check Claude CLI availability and auth status (cached)
- [x] `tierToModel` mapping: fast -> haiku, standard -> sonnet, premium -> opus

### Integration
- [x] Activates before ext-ai-claude (alphabetical order) so it becomes default provider
- [x] All existing AI consumers work unchanged through AIService facade
- [x] Strip `CLAUDECODE=1` env var when spawning Agent SDK queries (prevents conflict when developing inside Claude Code)

## Agent SDK Key APIs

```typescript
import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'

// Simple completion (maps to AIProvider.complete)
for await (const msg of query({
  prompt: userMessage,
  options: {
    systemPrompt: '...',
    model: 'sonnet',
    maxTurns: 1,
    permissionMode: 'plan',  // read-only, no side effects
  }
})) {
  if (msg.type === 'result' && msg.subtype === 'success') {
    return { content: msg.result, model: '...', usage: msg.usage }
  }
}

// Streaming (maps to AIProvider.stream)
for await (const msg of query({
  prompt: userMessage,
  options: { includePartialMessages: true, model: 'sonnet', maxTurns: 1 }
})) {
  if (msg.type === 'stream_event') {
    onChunk({ delta: msg.event.delta?.text, done: false })
  }
  if (msg.type === 'result') {
    onChunk({ delta: '', done: true, model: '...', usage: msg.usage })
  }
}

// Tool calling (maps to AIProvider.completeWithTools)
const mcpServer = createSdkMcpServer({
  name: 'openorbit-tools',
  tools: [
    tool('analyze_job', 'Analyze a job listing', { job: z.string() },
      async (args) => ({ content: [{ type: 'text', text: '...' }] }))
  ]
})
for await (const msg of query({
  prompt: userMessage,
  options: { mcpServers: { tools: mcpServer }, maxTurns: 3 }
})) { ... }
```

## Setup

The ext-ai-claude-sdk extension activates automatically on startup. No configuration needed if:

1. **Claude Code CLI is installed**: `npm install -g @anthropic-ai/claude-code` (or installed via the VS Code extension)
2. **Logged in with Max plan**: Run `claude` in a terminal and complete the login flow
3. **Verify**: The provider registers automatically. Check the app logs for `"Claude Agent SDK provider registered (Max plan)"`

If the Claude CLI is not found or not authenticated, the extension logs a warning and falls back to ext-ai-claude (API key provider).

### How It Becomes Default

Extensions activate alphabetically. `ext-ai-claude-sdk` comes before `ext-ai-claude`, so it registers first and becomes the default provider. The ext-ai-claude provider remains available as a fallback if the user has an API key configured.

## Key Considerations

- **Subprocess overhead**: Agent SDK spawns a Claude Code process per `query()` call (~1-2s startup). Acceptable for personal use but slower than direct API calls. Session resume can amortize this for batch operations.
- **CLAUDECODE env var**: When developing inside Claude Code, the `CLAUDECODE=1` env var prevents nested SDK sessions. Must strip from `options.env`.
- **No direct message array support**: Unlike the Anthropic API, the Agent SDK takes a single prompt string. Multi-turn chat must serialize history into the prompt or use session resume with `--continue`.

## Success Criteria

- [x] Provider registered and becomes default via alphabetical activation order
- [x] `isConfigured()` returns true when Claude Code is logged in with Max plan
- [x] Existing ChatHandler, JobAnalyzer, AnswerGenerator work through new provider
- [x] Job analysis batch completes successfully via Max plan
- [x] No API key required — all auth via Max plan subscription
