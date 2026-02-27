# 13.3: IPC Channels

**Effort:** Medium | **Status:** Not started

## Background

The Skills Panel needs 6 IPC channels to manage the skill catalog from the renderer. This follows the same `validatedHandle` pattern used by all existing shell and extension IPC handlers.

## Tasks

### IPC Channel Constants
- [ ] Add 6 channels to `packages/core/src/ipc-channels.ts`:
  ```
  SKILL_CATALOG_LIST:      'skill:catalog-list'
  SKILL_CATALOG_INSTALL:   'skill:catalog-install'
  SKILL_CATALOG_UNINSTALL: 'skill:catalog-uninstall'
  SKILL_CUSTOM_CREATE:     'skill:custom-create'
  SKILL_CUSTOM_UPDATE:     'skill:custom-update'
  SKILL_CUSTOM_DELETE:     'skill:custom-delete'
  ```

### Zod Schemas
- [ ] Add 6 schemas to `packages/core/src/ipc-schemas.ts`:
  - `skill:catalog-list` → `{ category?: SkillCategory }` (optional filter)
  - `skill:catalog-install` → `{ skillId: string }`
  - `skill:catalog-uninstall` → `{ skillId: string }`
  - `skill:custom-create` → `{ displayName: string, description: string, category: SkillCategory, icon?: string, content: string }`
  - `skill:custom-update` → `{ id: string, displayName?: string, description?: string, category?: string, icon?: string, content?: string }`
  - `skill:custom-delete` → `{ skillId: string }`

### IPC Handlers
- [ ] Add 6 `validatedHandle` blocks to `src/main/ipc-handlers.ts`
  - Initialize `UserSkillsRepo` from `getDatabase()`
  - `catalog-list`: merge catalog skills + custom skills, annotate with `isInstalled` state
  - `catalog-install`: `settingsRepo.update('skill.{id}.installed', '1')`
  - `catalog-uninstall`: `settingsRepo.update('skill.{id}.installed', '0')`
  - `custom-create`: generate ID, insert into `user_skills`
  - `custom-update`: update in `user_skills`
  - `custom-delete`: delete from `user_skills` + remove settings key

### Response Shape
- [ ] Define `CatalogListItem` interface:
  ```typescript
  interface CatalogListItem {
    id: string
    displayName: string
    description: string
    category: SkillCategory
    icon: string
    type: 'instruction' | 'tool'
    isBuiltIn: boolean
    isCustom: boolean
    isInstalled: boolean
  }
  ```

### Update Tests
- [ ] Update `packages/core/src/__tests__/ipc-channels.test.ts` — channel count 41 → 47

## Key Patterns

### Channel Naming Rule

All channels must match `/^[a-z-]+:[a-z-]+$/` — no camelCase. The `skill:` prefix groups all catalog channels together.
