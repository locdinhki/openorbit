# 15.2: PDF Generation Skill

**Effort:** Medium | **Depends on:** Phase 12 (Skill System) | **Status:** Complete

## Goal

Add a built-in tool skill that generates PDFs from structured section definitions using `pdf-lib` (pure TypeScript, zero native deps). Foundation for the deal analyzer's export feature and broadly useful across all extensions.

## Skill Definition

- **id:** `pdf-generate`
- **category:** `document`
- **icon:** `file-text`
- **capabilities:** `{ aiTool: true, offlineCapable: true, streaming: false }`
- **AI tool name:** `skill_pdf_generate`

### Input Schema

```typescript
{
  title: string,
  subtitle?: string,
  sections: [
    {
      heading?: string,                        // bold heading text
      body?: string,                           // paragraph with {{field}} merge support
      keyValues?: [{ key: string, value: string }],  // key-value grid
      table?: { headers: string[], rows: string[][] },  // table with borders
      image?: { data: string, width: number, height: number }  // base64 PNG
    }
  ],
  mergeFields?: Record<string, string>,  // {{fieldName}} → value
  outputFormat?: 'base64' | 'file',
  outputPath?: string
}
```

### Output

```typescript
{
  base64?: string,      // if outputFormat is 'base64'
  filePath?: string,    // if outputFormat is 'file'
  pageCount: number,
  byteSize: number
}
```

## PDF Builder Features

- **Page setup:** US Letter (612 × 792pt), 50pt margins
- **Fonts:** Helvetica (standard), Helvetica-Bold (headings)
- **Sections:** headings, body text with word-wrap, key-value grids, tables with cell borders, embedded PNG images
- **Merge fields:** regex replace `{{fieldName}}` in body text and table cells
- **Footer:** page numbers centered at bottom of each page
- **Auto-pagination:** sections flow across pages automatically

## New Files

| File | Purpose |
|------|---------|
| `packages/core/src/skills/builtin/pdf-builder.ts` | pdf-lib wrapper (layout, sections, merge fields, images, page numbers) |
| `packages/core/src/skills/builtin/pdf-generate-skill.ts` | `createPdfGenerateSkill(extensionId): Skill` |
| `packages/core/src/skills/builtin/__tests__/pdf-builder.test.ts` | Unit tests |

## Modified Files

| File | Change |
|------|--------|
| `package.json` | Add `pdf-lib` dependency |
| `src/main/index.ts` | Import + register |
| `packages/core/src/skills/skill-catalog.ts` | Change `pdf-generation` entry: `type: 'tool'`, `isBuiltIn: true`, remove `content` |

## Success Criteria

- [x] `pdf-lib` installs cleanly (no native deps, no build step)
- [x] Skill produces valid PDF bytes that open in standard PDF readers
- [x] All merge fields `{{fieldName}}` are resolved in output
- [x] Multi-page documents have correct page numbers in footer
- [x] PNG images embed correctly at specified dimensions
- [x] `npx vitest run` passes
