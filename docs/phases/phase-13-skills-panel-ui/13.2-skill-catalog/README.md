# 13.2: Skill Catalog

**Effort:** Medium | **Status:** Not started

## Background

The skill catalog is a static TypeScript array of shipped skill definitions. It merges tool skills (from Phase 12's SkillRegistry) and instruction skills (new markdown-based skills) into a unified browsable list. Catalog install state is tracked in the `settings` table.

## Tasks

### CatalogSkill Type
- [ ] Define `CatalogSkill` interface in `packages/core/src/skills/skill-catalog.ts`
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

### Shipped Catalog Array
- [ ] Define static `SKILL_CATALOG` array with 12 entries:

  | ID | Name | Category | Type |
  |----|------|----------|------|
  | `voice-transcribe` | Voice Transcriber | media | tool (built-in) |
  | `calc-expression` | Calculator | data | tool (built-in) |
  | `data-format` | Data Formatter | data | tool (built-in) |
  | `pdf-generation` | PDF | document | instruction |
  | `spreadsheet` | Spreadsheet | data | instruction |
  | `email-smtp` | Email (SMTP) | communication | instruction |
  | `sms-mms` | SMS / MMS | communication | instruction |
  | `charts-visualization` | Charts & Visualization | data | instruction |
  | `document-generation` | Document Generation | document | instruction |
  | `financial-calculator` | Financial Calculator | data | instruction |
  | `ocr-extraction` | OCR / Text Extraction | media | instruction |
  | `web-scraper` | Web Scraper | utility | instruction |

### Instruction Skill Content
- [ ] Each instruction skill ships with a markdown `content` field containing an AI instruction template with sections: Workflow, Conventions, Dependencies, Quality Gates
- [ ] Tool skills (built-in) have no `content` — they're already registered in the SkillRegistry

### Helper Functions
- [ ] `getCatalogSkills()` → full catalog array
- [ ] `isSkillInstalled(id, settingsRepo, userSkillsRepo)` → checks `settings` for catalog skills, always true for built-in/custom
- [ ] `getInstalledInstructionContent(settingsRepo, userSkillsRepo)` → returns combined markdown content of all installed instruction skills (for AI system prompt injection)

## Key Patterns

### Install State Tracking

Catalog skills use the existing `settings` table:
- `settingsRepo.get('skill.pdf-generation.installed')` → `'1'` or `'0'` or null (not installed)
- Custom skills are always "installed" (they exist in `user_skills` table)
- Built-in tool skills are always installed (no toggle)
