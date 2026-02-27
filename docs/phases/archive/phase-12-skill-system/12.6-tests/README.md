# 12.6: Tests

**Effort:** Medium | **Status:** Complete

## Tasks

### Skill Registry Tests
- [x] `packages/core/src/skills/__tests__/skill-registry.test.ts` (13 tests)
  - `register()` — registers skill, replaces existing, logs
  - `unregister()` — removes skill
  - `get()` / `list()` / `listInfo()` — retrieval, category filtering
  - `execute()` — success path, error handling, validation failure, timing
  - `toAITools()` — name transformation (`skill_` prefix, underscores), `aiTool: false` filtering
  - `toService()` — all facade methods delegate correctly

### Skill Tool Dispatcher Tests
- [x] `packages/core/src/skills/__tests__/skill-tool-dispatcher.test.ts` (7 tests)
  - `isSkillToolCall()` — `true` for `skill_*`, `false` for others
  - `toolNameToSkillId()` — correct conversion
  - `executeSkillTool()` — success path, error path
  - `getCombinedTools()` — merges extension tools + skill tools

### Built-in Skills Tests
- [x] `packages/core/src/skills/__tests__/builtin-skills.test.ts` (27 tests)
  - **Voice Transcribe:** mock `VoiceTranscriber` (class-based mock for vitest v4), verify delegation and result mapping
  - **Calculator:** basic arithmetic (`2+3*4=14`), functions (`sqrt(16)=4`), error cases (invalid chars, identifier allowlist, division by zero), `pi` constant
  - **Data Formatter:** JSON→CSV, CSV→JSON, pretty-print JSON, error on invalid input

## Test Patterns

Follow existing test patterns:
- `vi.mock()` for external dependencies (VoiceTranscriber)
- Direct instantiation for pure logic (calculator, formatter)
- `describe` / `it` blocks matching the function being tested
