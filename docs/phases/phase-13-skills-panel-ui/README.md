# Phase 13: Skills Panel UI

**Theme:** Browsable skill catalog inspired by OpenAI Codex's Skills screen — users can install/uninstall shipped instruction skills and create custom markdown instruction skills stored in DB. Instruction skills inject context into AI system prompts.

**Effort:** Moderate | **Depends on:** Phase 12 | **Status:** Not started

## Why This Phase

Phase 12 built the skill system backend (registry, IPC, built-in tool skills, AI tool integration). But there's no way for users to browse available skills, install instruction-based skills, or create their own custom AI instruction sets.

The Skills Panel introduces:

1. A **shipped catalog** of instruction skills (PDF, Spreadsheet, Email, etc.) derived from `docs/research-ideas.md`
2. **Install/uninstall** — instruction skills inject markdown content into AI system prompts when installed
3. **Custom skills** — user-created markdown instruction files stored in a `user_skills` DB table
4. A **Codex-style grid UI** — card-based browsable interface with search, category tabs, and a creation modal

Skills come in two types:
- **Tool skills** (built-in) — code-based skills from Phase 12 (calc, format, voice-transcribe). Always installed, shown as "Built-in".
- **Instruction skills** — markdown files with Workflow/Conventions/Dependencies/Quality Gates sections. Injected into AI system prompt when installed.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 13.1 | [DB Schema & Repo](13.1-db-schema-repo/) | Low | V8 migration (`user_skills` table), `UserSkillsRepo` |
| 13.2 | [Skill Catalog](13.2-skill-catalog/) | Medium | Static catalog array, install state helpers, instruction content aggregator |
| 13.3 | [IPC Channels](13.3-ipc-channels/) | Medium | 6 channels: catalog list/install/uninstall, custom create/update/delete |
| 13.4 | [AI Chat Integration](13.4-ai-chat-integration/) | Low | Inject installed instruction content into GHL AI chat system prompt |
| 13.5 | [Renderer UI](13.5-renderer-ui/) | High | SkillsPanel, SkillCard, CreateSkillModal, IPC client, sidebar item |

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Skill Catalog                          │
│  Static array: 12 shipped skills (3 tool + 9 instruction)     │
│  getCatalogSkills() / isSkillInstalled() / getInstalled...()  │
└────────────┬──────────────────────┬───────────────────────────┘
             │                      │
   ┌─────────▼─────────┐  ┌────────▼─────────────────────┐
   │  UserSkillsRepo    │  │  Settings Table               │
   │  (user_skills DB)  │  │  skill.{id}.installed = '1'   │
   │  Custom skills     │  │  Catalog install state         │
   └─────────┬─────────┘  └────────┬─────────────────────┘
             │                      │
   ┌─────────▼──────────────────────▼─────────────────────┐
   │  IPC Handlers (6 channels)                            │
   │  catalog-list / catalog-install / catalog-uninstall    │
   │  custom-create / custom-update / custom-delete         │
   └────────────┬────────────────────────────────┬────────┘
                │                                │
   ┌────────────▼────────────┐       ┌───────────▼──────────┐
   │  Renderer: SkillsPanel   │       │  AI Chat Handler      │
   │  Grid, Cards, Modal      │       │  Inject instruction    │
   │  Install/Uninstall       │       │  content into prompt   │
   └──────────────────────────┘       └────────────────────────┘
```

### CatalogSkill Interface

```typescript
interface CatalogSkill {
  id: string
  displayName: string
  description: string
  category: SkillCategory
  icon: string
  type: 'instruction' | 'tool'
  content?: string        // markdown for instruction skills
  isBuiltIn: boolean      // true = always installed, can't uninstall
}
```

### UI Layout (Codex-inspired)

```
┌──────────────────────────────────────────────────────────────┐
│  Skills                          Refresh  Search      + New   │
├──────────────────────────────────────────────────────────────┤
│  [All] [Document] [Data] [Media] [Communication] [Utility]   │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────┐  ┌────────────────────┐              │
│  │ PDF                │  │ Calculator         │              │
│  │ Create, edit, and  │  │ Evaluate math      │              │
│  │ review PDFs        │  │ expressions        │              │
│  │            [+ / ✓] │  │         [Built-in] │              │
│  └────────────────────┘  └────────────────────┘              │
│  ...                     ...                                  │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Order

```
13.1 DB Schema & Repo (V8 migration + UserSkillsRepo)
         |
13.2 Skill Catalog (static array + helpers)
         |
13.3 IPC Channels (6 channels + schemas + handlers)
         |
13.4 AI Chat Integration (instruction injection)
         |
13.5 Renderer UI (SkillsPanel + SkillCard + CreateSkillModal)
```

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `packages/core/src/skills/user-skills-repo.ts` | DB repo for custom skills |
| `packages/core/src/skills/skill-catalog.ts` | Shipped catalog + helpers |
| `src/renderer/src/components/Shell/views/SkillsPanel.tsx` | Main skills panel |
| `src/renderer/src/components/Shell/views/SkillCard.tsx` | Skill card component |
| `src/renderer/src/components/Shell/views/CreateSkillModal.tsx` | Create/edit modal |

### Modified Files

| File | Change |
|------|--------|
| `packages/core/src/db/database.ts` | Add V8 migration (user_skills table) |
| `packages/core/src/ipc-channels.ts` | Add 6 skill catalog channels |
| `packages/core/src/ipc-schemas.ts` | Add 6 Zod schemas |
| `src/main/ipc-handlers.ts` | Add 6 catalog handlers + UserSkillsRepo init |
| `src/main/index.ts` | Pass UserSkillsRepo to services if needed |
| `src/renderer/src/lib/ipc-client.ts` | Add skillCatalog section |
| `src/renderer/src/components/Shell/shell-sidebar-items.ts` | Add shell-skills item |
| `src/renderer/src/App.tsx` | Register shell-skills view |
| `src/renderer/src/components/shared/SvgIcon.tsx` | Add puzzle icon |
| `packages/extensions/ext-ghl/src/main/ai/ghl-chat-handler.ts` | Inject instruction content |
| `packages/core/src/__tests__/ipc-channels.test.ts` | Update count 41 → 47 |

## Success Criteria

- [ ] `npx vitest run` — all existing + new tests pass
- [ ] `npx electron-vite build` — builds without errors
- [ ] Activity bar shows "Skills" icon between Extensions and Automations
- [ ] Skills panel displays 2-column grid with 12 skills (3 built-in + 9 catalog)
- [ ] Clicking "+" installs a skill, checkmark appears
- [ ] Clicking checkmark uninstalls
- [ ] "+ New skill" opens modal, creating saves to DB and shows in grid as "Custom"
- [ ] Built-in skills show "Built-in" badge with no uninstall option
- [ ] Installed instruction skills' content is injected into GHL AI chat system prompt
