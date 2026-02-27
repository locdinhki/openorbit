# Phase 12: Skill System

**Theme:** Generic, reusable capabilities that any extension or AI chat can invoke. Skills are horizontal building blocks (calculator, transcription, data formatting, etc.) — unlike extensions which are vertical, service-specific integrations.

**Effort:** Moderate | **Depends on:** Phase 11 | **Status:** Complete

## Why This Phase

OpenOrbit has a mature extension system (12 extensions) and AI provider registry, but all capabilities are locked inside specific extensions. There's no way for the AI chat to calculate a math expression, format data, or transcribe audio without extension-specific tool definitions.

The Skill System introduces a **horizontal capability layer** — a registry of generic, composable capabilities that:

1. Any extension can register during `activate()`
2. Any extension can invoke via `ctx.services.skills.execute()`
3. AI chat handlers automatically gain access via tool calling
4. The renderer can list and invoke via IPC channels

This follows the exact same architectural pattern as the AI Provider Registry (`AIProviderRegistry` → `AIService` → `SharedServices.ai`), applied to generic capabilities instead of AI providers.

An existing capability — `VoiceTranscriber` (Whisper) in `packages/core/src/audio/voice-transcriber.ts` — will be wrapped as the first real skill, validating the framework.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 12.1 | [Core Infrastructure](12.1-core-infrastructure/) | Medium | Skill types, registry, tool dispatcher, SharedServices wiring |
| 12.2 | [IPC Channels](12.2-ipc-channels/) | Low | 3 channels: list, execute, info |
| 12.3 | [Built-in Skills](12.3-builtin-skills/) | Medium | voice-transcribe, calc-expression, data-format |
| 12.4 | [AI Chat Integration](12.4-ai-chat-integration/) | Low | Skills → AI tool definitions, dispatch in GHL chat |
| 12.5 | [Manifest Support](12.5-manifest-support/) | Low | Optional `skills` contribution point in extension manifests |
| 12.6 | [Tests](12.6-tests/) | Medium | Registry, dispatcher, and built-in skill tests |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         SkillRegistry                           │
│  Map<string, Skill>                                             │
│  register() / unregister() / get() / list() / execute()         │
│  toAITools() → AIToolDefinition[]                               │
│  toService() → SkillService (facade for SharedServices)         │
└────────────┬──────────────────────┬────────────────────────┬────┘
             │                      │                        │
   ┌─────────▼─────────┐  ┌────────▼────────┐  ┌───────────▼──────────┐
   │  SharedServices    │  │  IPC Handlers    │  │  AI Tool Dispatcher  │
   │  ctx.services.     │  │  skill:list      │  │  isSkillToolCall()   │
   │    skills           │  │  skill:execute   │  │  executeSkillTool()  │
   │                    │  │  skill:info      │  │  getCombinedTools()  │
   └─────────┬─────────┘  └─────────────────┘  └───────────┬──────────┘
             │                                              │
   ┌─────────▼─────────┐                         ┌─────────▼──────────┐
   │  Extensions        │                         │  AI Chat Handlers   │
   │  register skills   │                         │  GHL, Jobs, etc.    │
   │  invoke skills     │                         │  skill_* tool calls │
   └───────────────────┘                         └────────────────────┘
```

### Skill Interface (mirrors AIProvider)

```typescript
interface Skill {
  readonly id: string              // 'calc-expression'
  readonly displayName: string     // 'Calculator'
  readonly description: string
  readonly category: SkillCategory // 'data' | 'media' | ...
  readonly extensionId: string     // 'shell' or 'ext-ghl'
  readonly capabilities: SkillCapabilities
  readonly inputSchema: SkillInputSchema
  readonly outputSchema: SkillOutputSchema
  execute(input: Record<string, unknown>): Promise<SkillResult>
}
```

### AI Tool Mapping

Skills with `capabilities.aiTool !== false` are automatically converted to `AIToolDefinition[]`:
- Skill ID `voice-transcribe` → tool name `skill_voice_transcribe`
- Prefix `skill_` prevents collision with extension-specific tools (e.g. `list_contacts`)

### Registration Pattern (same as AI providers)

```typescript
// In extension activate():
ctx.services.skills.registerSkill(mySkill)

// In AI chat handler:
const tools = getCombinedTools(GHL_TOOLS, ctx.services.skills)
```

## Implementation Order

```
12.1 Core Infrastructure (types, registry, dispatcher)
         |
12.2 IPC Channels (list, execute, info)
         |
12.3 Built-in Skills (voice-transcribe, calc, format)
         |
12.4 AI Chat Integration (GHL chat handler)
         |
12.5 Manifest Support (optional contribution point)
         |
12.6 Tests
```

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `packages/core/src/skills/skill-types.ts` | Core interfaces |
| `packages/core/src/skills/skill-registry.ts` | Registry class |
| `packages/core/src/skills/skill-tool-dispatcher.ts` | AI bridge |
| `packages/core/src/skills/builtin/voice-transcribe-skill.ts` | Wraps VoiceTranscriber |
| `packages/core/src/skills/builtin/calc-skill.ts` | Math evaluator |
| `packages/core/src/skills/builtin/format-skill.ts` | JSON/CSV converter |

### Modified Files

| File | Change |
|------|--------|
| `packages/core/src/extensions/types.ts` | Add `skills: SkillService` to SharedServices |
| `packages/core/src/ipc-channels.ts` | Add 3 skill channels |
| `packages/core/src/ipc-schemas.ts` | Add 3 Zod schemas |
| `src/main/ipc-handlers.ts` | Add setSkillService + 3 handlers |
| `src/main/index.ts` | Create SkillRegistry, wire services, register built-ins |
| `packages/extensions/ext-ghl/src/main/ai/ghl-chat-handler.ts` | Accept SkillService, combine tools |

## Success Criteria

- [x] `skill:list` returns 3 built-in skills from renderer
- [x] `skill:execute` with `calc-expression` evaluates expressions correctly
- [x] `skill:execute` with `voice-transcribe` delegates to VoiceTranscriber
- [x] GHL AI chat can invoke skill tools (e.g. "what is 25 * 4?" uses `skill_calc_expression`)
- [x] Extensions can register custom skills during activation
- [x] All new + existing tests pass (51 skill system tests)
- [x] `npx electron-vite build` succeeds
