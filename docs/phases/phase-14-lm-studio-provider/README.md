# Phase 14: LM Studio AI Provider Extension

**Theme:** Add LM Studio as a local LLM provider, giving users another local inference option alongside Ollama. LM Studio exposes an OpenAI-compatible REST API on port 1234.

**Effort:** Low | **Depends on:** Phase 6 (extension system) | **Status:** Not started

## Why This Phase

OpenOrbit already supports 4 AI providers (Claude SDK, Claude API, OpenAI, Ollama). LM Studio is a popular desktop app for running local LLMs with a one-click setup and OpenAI-compatible API. Adding `ext-ai-lm-studio` follows the exact same pattern as `ext-ai-ollama` — minimal code, maximum value.

Key difference from Ollama: LM Studio uses **OpenAI-format endpoints** (`/v1/chat/completions`, `/v1/models`) with **SSE streaming** (not NDJSON), so streaming code follows `ext-ai-openai`'s pattern while the structural pattern (auto-discovery, configurable URL, no API key) follows `ext-ai-ollama`.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 14.1 | [Extension Scaffold](14.1-extension-scaffold/) | Low | package.json, entry points, renderer stub |
| 14.2 | [Provider Implementation](14.2-provider-implementation/) | Medium | LmStudioProvider: discovery, completions, streaming, tool calling |
| 14.3 | [Shell Integration](14.3-shell-integration/) | Low | Vite aliases, preloadedModules registration |

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  ext-ai-lm-studio                                    │
│                                                      │
│  LmStudioProvider implements AIProvider               │
│    ├── refreshModels()  → GET /v1/models              │
│    ├── complete()       → POST /v1/chat/completions   │
│    ├── chat()           → POST /v1/chat/completions   │
│    ├── stream()         → POST (stream: true, SSE)    │
│    └── completeWithTools() → POST (tools[], SSE)      │
│                                                      │
│  activate(ctx) → ctx.services.ai.registerProvider()   │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐     ┌──────────────────────┐
│  AIProviderRegistry  │ ◄── │  LM Studio Server     │
│  (shell-level)       │     │  http://localhost:1234 │
└─────────────────────┘     └──────────────────────┘
```

### LM Studio API (OpenAI-compatible)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/models` | GET | List available/downloaded models |
| `/v1/chat/completions` | POST | Chat completions (stream: true/false) |

- Default port: 1234
- No API key required by default (optional auth in Developer settings)
- Model names are local identifiers (e.g. `lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF`)
- SSE format: `data: {...}\n\n` lines, terminated by `data: [DONE]`
- Tool calling supported (model-dependent)

## Implementation Order

```
14.1 Extension Scaffold (package.json, entry points)
         |
14.2 Provider Implementation (LmStudioProvider)
         |
14.3 Shell Integration (Vite aliases, preloadedModules)
```

## Files Summary

### New Files (4)

| File | Purpose |
|------|---------|
| `packages/extensions/ext-ai-lm-studio/package.json` | Extension manifest + settings |
| `packages/extensions/ext-ai-lm-studio/src/main/index.ts` | Activation entry |
| `packages/extensions/ext-ai-lm-studio/src/main/lm-studio-provider.ts` | AIProvider implementation |
| `packages/extensions/ext-ai-lm-studio/src/renderer/index.ts` | Stub renderer |

### Modified Files (2)

| File | Change |
|------|--------|
| `electron.vite.config.ts` | Add `@openorbit/ext-ai-lm-studio` alias to main + renderer |
| `src/main/index.ts` | Import + register in preloadedModules |

### Reference Files (read, not modified)

| File | Reuse |
|------|-------|
| `packages/extensions/ext-ai-ollama/src/main/ollama-provider.ts` | Structure template (discovery, settings, isConfigured, wrapError) |
| `packages/extensions/ext-ai-openai/src/main/openai-provider.ts` | SSE stream parsing, OpenAI request/response format, tool calling |
| `packages/core/src/ai/provider-types.ts` | AIProvider interface |

## Success Criteria

- [ ] `npx vitest run` — all existing tests pass
- [ ] `npx electron-vite build` — builds without errors
- [ ] Extension appears in Extensions panel under "AI" category
- [ ] With LM Studio running: provider shows in AI provider dropdown, models auto-discovered
- [ ] Set as default → AI chat completions route through LM Studio
- [ ] Streaming works (SSE format parsed correctly)
- [ ] Tool calling works for models that support it
- [ ] Without LM Studio running: `isConfigured()` returns false, provider gracefully unavailable
