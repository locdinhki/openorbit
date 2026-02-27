# 12.2: IPC Channels

**Effort:** Low | **Status:** Complete

## Background

The renderer needs to list available skills, invoke them, and get skill details. This follows the same pattern as `ai:providers`, `ai:complete`, etc.

## Tasks

### Channel Definitions
- [x] Add 3 channels to `packages/core/src/ipc-channels.ts`:
  - `SKILL_LIST: 'skill:list'`
  - `SKILL_EXECUTE: 'skill:execute'`
  - `SKILL_INFO: 'skill:info'`

### Zod Schemas
- [x] Add 3 schemas to `packages/core/src/ipc-schemas.ts`:
  - `skill:list` → `{ category?: SkillCategory }`
  - `skill:execute` → `{ skillId: string, input?: Record<string, unknown> }`
  - `skill:info` → `{ skillId: string }`

### IPC Handlers
- [x] Add `setSkillService(s)` to `src/main/ipc-handlers.ts`
- [x] Add 3 validated handlers (list, execute, info)
- [x] Call `setSkillService()` from `src/main/index.ts`

### Test Update
- [x] Update channel count in `packages/core/src/__tests__/ipc-channels.test.ts` (38 → 41)

## IPC Channels

| Channel | Schema | Response |
|---------|--------|----------|
| `skill:list` | `{ category?: SkillCategory }` | `{ success, data: SkillInfo[] }` |
| `skill:execute` | `{ skillId, input? }` | `{ success, data: SkillResult }` |
| `skill:info` | `{ skillId }` | `{ success, data: SkillInfo }` |
