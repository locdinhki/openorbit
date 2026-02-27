# 12.1: Core Infrastructure

**Effort:** Medium | **Status:** Complete

## Background

The AI Provider Registry (`AIProviderRegistry` → `AIService` → `SharedServices.ai`) provides a proven pattern for registering capabilities at the shell level and exposing them to extensions. The Skill System replicates this exact pattern for generic capabilities.

## Tasks

### Skill Type Definitions
- [x] Create `packages/core/src/skills/skill-types.ts`
  - `SkillCategory`: `'document' | 'communication' | 'data' | 'media' | 'utility'`
  - `Skill` interface: `id`, `displayName`, `description`, `category`, `extensionId`, `capabilities`, `inputSchema`, `outputSchema`, `execute()`, optional `validate()`
  - `SkillResult`: `success`, `data?`, `summary?`, `error?`, `durationMs?`
  - `SkillCapabilities`: `streaming?`, `requiresBrowser?`, `offlineCapable?`, `aiTool?`
  - `SkillInfo`: renderer-safe subset (no `execute` function)
  - `SkillService` facade: `registerSkill`, `unregisterSkill`, `getSkill`, `listSkills`, `execute`, `toAITools()`

### Skill Registry
- [x] Create `packages/core/src/skills/skill-registry.ts`
  - `Map<string, Skill>` storage (mirrors `AIProviderRegistry.providers`)
  - `register()` / `unregister()` / `get()` / `list()` / `listInfo()`
  - `execute()` — validates, runs, wraps errors, adds timing
  - `toAITools()` — converts skills to `AIToolDefinition[]` with `skill_` prefix
  - `toService()` — creates `SkillService` facade

### AI Tool Dispatcher
- [x] Create `packages/core/src/skills/skill-tool-dispatcher.ts`
  - `isSkillToolCall(name)` — checks `skill_` prefix
  - `toolNameToSkillId(name)` — `skill_voice_transcribe` → `voice-transcribe`
  - `executeSkillTool(call, skillService)` → `AIToolResult`
  - `getCombinedTools(extensionTools, skillService)` → merged tools

### SharedServices Integration
- [x] Add `skills: SkillService` to `SharedServices` in `packages/core/src/extensions/types.ts`
- [x] Create `SkillRegistry` in `src/main/index.ts`, wire via `toService()` into services object

## Key Patterns

### Registry Pattern (matches AIProviderRegistry exactly)

```typescript
// AIProviderRegistry:
const aiRegistry = new AIProviderRegistry()
const aiServiceFacade = aiRegistry.toService()
services: { ai: aiServiceFacade }

// SkillRegistry (same pattern):
const skillRegistry = new SkillRegistry()
const skillServiceFacade = skillRegistry.toService()
services: { skills: skillServiceFacade }
```

### AI Tool Name Convention

Skill IDs use kebab-case (`calc-expression`). AI tool names use underscores with `skill_` prefix (`skill_calc_expression`). This prevents collision with extension-specific tools like `list_contacts`.
