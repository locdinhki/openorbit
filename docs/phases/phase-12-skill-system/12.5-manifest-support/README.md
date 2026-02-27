# 12.5: Manifest Support

**Effort:** Low | **Status:** Complete

## Background

Extensions declare their contribution points (sidebar, workspace, panel, settings) in `package.json` under the `openorbit.contributes` field. Adding a `skills` contribution point lets the Extensions panel show what skills an extension provides — even before activation.

## Tasks

### Type Definitions
- [x] Add `SkillContribution` to `packages/core/src/extensions/types.ts`:
  ```typescript
  interface SkillContribution {
    id: string
    label: string
    category: SkillCategory
  }
  ```
- [x] Add `skills?: SkillContribution[]` to `ExtensionContributes`

### Manifest Validation
- [x] Add Zod schema for `skills` in `packages/core/src/extensions/manifest.ts`

## Usage

This is **declarative only** — the Extensions panel can display skill information, but actual registration happens in `activate()`.

```json
{
  "openorbit": {
    "id": "ext-example",
    "contributes": {
      "skills": [
        { "id": "pdf-generate", "label": "PDF Generator", "category": "document" }
      ]
    }
  }
}
```
