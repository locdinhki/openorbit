# 14.2: Provider Implementation

**Effort:** Medium | **Status:** Not started

## Background

`LmStudioProvider` implements the `AIProvider` interface. It's a hybrid: structural patterns from `ext-ai-ollama` (dynamic discovery, configurable URL, no API key) with API format from `ext-ai-openai` (OpenAI endpoints, SSE streaming).

## Tasks

### LmStudioProvider Class
- [ ] Create `packages/extensions/ext-ai-lm-studio/src/main/lm-studio-provider.ts`
  - `id`: `'lm-studio'`
  - `displayName`: `'LM Studio (Local)'`
  - `capabilities`: `{ streaming: true, toolCalling: true, vision: false, models: [] }`

### Model Discovery
- [ ] `refreshModels()` — `GET {baseUrl}/v1/models` with 3s timeout
  - Parse `response.data[].id` → populate `cachedModels` and `capabilities.models`
  - Fire non-blocking in constructor (same as Ollama)
  - Silently catch connection errors (server may not be running)

### Configuration
- [ ] `getBaseUrl()` — reads `settingsRepo.get('lmstudio_base_url')`, fallback `'http://localhost:1234'`
- [ ] `resolveModel(tier)` — reads `lmstudio_model_{tier}` setting, fallback to first discovered model
- [ ] `isConfigured()` → `cachedModels !== null && cachedModels.length > 0`
- [ ] `resetClient()` → `cachedModels = null` (force rediscovery)

### Completions (OpenAI format)
- [ ] `complete(request)` — `POST {baseUrl}/v1/chat/completions` with `stream: false`
  ```typescript
  body: {
    model: resolvedModel,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
    max_tokens: maxTokens ?? 4096,
    temperature: 0.7
  }
  ```
- [ ] `chat(request)` — same endpoint, takes full `messages[]` array

### Streaming (SSE format from ext-ai-openai)
- [ ] `stream(request, onChunk)` — `POST` with `stream: true`
  - Read line-by-line, strip `data: ` prefix
  - `[DONE]` sentinel = stream end
  - Parse `choices[0].delta.content` for each chunk
  - Call `onChunk({ delta, done })` for each chunk

### Tool Calling
- [ ] `completeWithTools(request)` — `POST` with `tools[]` array
  - Tools use OpenAI format: `{ type: 'function', function: { name, description, parameters } }`
  - Parse `tool_calls` from response: `{ id, type: 'function', function: { name, arguments } }`

### Usage Tracking
- [ ] `usageRepo.record(...)` with `apiKeyHash: 'lmstudio-local'`

### Error Handling
- [ ] `wrapError()` — detect `ECONNREFUSED`/`fetch failed` for connection errors (same as Ollama)

## Key Differences from Ollama Provider

| Aspect | Ollama | LM Studio |
|--------|--------|-----------|
| API format | Ollama-native (`/api/chat`) | OpenAI-compat (`/v1/chat/completions`) |
| Streaming | NDJSON (line-by-line JSON) | SSE (`data: ` prefix, `[DONE]` sentinel) |
| Model discovery | `/api/tags` → `models[].name` | `/v1/models` → `data[].id` |
| Tool calling | Not supported | Supported (model-dependent) |
| Default port | 11434 | 1234 |
| Auth | None | Optional Bearer token |

## Key Differences from OpenAI Provider

| Aspect | OpenAI | LM Studio |
|--------|--------|-----------|
| API key | Required | Optional |
| Models | Static list (gpt-4o, etc.) | Dynamic (downloaded models) |
| Base URL | `https://api.openai.com` | `http://localhost:1234` |
| isConfigured() | Checks API key | Checks server reachability |
| Model names | `gpt-4o-mini`, `gpt-4o`, `o1` | Local identifiers |
