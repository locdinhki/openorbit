# Phase 15: Deal Analysis & Reporting

**Theme:** Three new built-in skills (Financial Calculator, PDF Generation, Charts) plus a full extension (ext-deal-analyzer) that composes them with ext-zillow and ext-ghl data for comprehensive real estate deal analysis.

**Effort:** High | **Depends on:** Phase 12 (Skill System), Phase 11 (ext-ghl, ext-zillow) | **Status:** Complete

## Why This Phase

OpenOrbit already has Zillow property data (Zestimate cache) and GoHighLevel CRM data (contacts, opportunities, pipelines). ext-deal-analyzer directly composes this existing data into a full deal analysis workflow — replacing $20-50/mo tools like DealCheck and Privy Pro. The three skills are horizontal building blocks that benefit all extensions, not just deals.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 15.1 | [Financial Calculator Skill](15.1-financial-calculator-skill/) | Medium | Pure TS real estate formulas (ROI, cap rate, DSCR, etc.) |
| 15.2 | [PDF Generation Skill](15.2-pdf-generation-skill/) | Medium | pdf-lib based PDF creation with merge fields |
| 15.3 | [Charts & Visualization Skill](15.3-charts-visualization-skill/) | Medium | Server-side chart rendering to PNG via chartjs-node-canvas |
| 15.4 | [Deal Analyzer Extension](15.4-deal-analyzer-extension/) | High | Full extension: DB, IPC, analysis engine, AI tools, UI |

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│ Shell (src/main/index.ts)                                │
│                                                          │
│  SkillRegistry                                           │
│    ├── calc-expression        (existing)                 │
│    ├── data-format            (existing)                 │
│    ├── voice-transcribe       (existing)                 │
│    ├── financial-calc         (NEW — 15.1)               │
│    ├── pdf-generate           (NEW — 15.2)               │
│    └── chart-render           (NEW — 15.3)               │
│                                                          │
│  preloadedModules                                        │
│    ├── ext-ghl, ext-zillow    (existing)                 │
│    └── ext-deal-analyzer      (NEW — 15.4)               │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│ ext-deal-analyzer                                        │
│                                                          │
│  DB: deals, deal_comps, deal_expenses                    │
│  IPC: 14 channels (CRUD, analyze, compare, export)       │
│  AI: 6 tool definitions for AI chat integration          │
│  Cross-ext: reads arv_cache, ghl_contacts,               │
│             ghl_opportunities                            │
│                                                          │
│  Composes:                                               │
│    ctx.services.skills.execute('financial-calc', ...)    │
│    ctx.services.skills.execute('chart-render', ...)      │
│    ctx.services.skills.execute('pdf-generate', ...)      │
└──────────────────────────────────────────────────────────┘
```

## Implementation Order

```
15.1 Financial Calculator ─┐
15.2 PDF Generation ───────┼─ (parallel, independent)
15.3 Charts & Viz ─────────┘
         │
         ▼
15.4 ext-deal-analyzer
  a. Scaffold + DB + Repos
  b. IPC + Analysis Engine
  c. AI Tools + PDF Export
  d. Renderer UI + Shell Integration
```

## New Dependencies

| Package | Native? | Purpose |
|---------|---------|---------|
| `pdf-lib` | No | PDF generation (pure TS) |
| `chart.js` | No | Chart.js core |
| `chartjs-node-canvas` | Yes (via canvas) | Server-side Chart.js → PNG |
| `canvas` | Yes | Node.js canvas for chartjs-node-canvas |

## Files Summary

### New Files (38)

| # | File | Subphase |
|---|------|----------|
| 1 | `packages/core/src/skills/builtin/financial-formulas.ts` | 15.1 |
| 2 | `packages/core/src/skills/builtin/financial-calc-skill.ts` | 15.1 |
| 3 | `packages/core/src/skills/builtin/__tests__/financial-formulas.test.ts` | 15.1 |
| 4 | `packages/core/src/skills/builtin/pdf-builder.ts` | 15.2 |
| 5 | `packages/core/src/skills/builtin/pdf-generate-skill.ts` | 15.2 |
| 6 | `packages/core/src/skills/builtin/__tests__/pdf-builder.test.ts` | 15.2 |
| 7 | `packages/core/src/skills/builtin/chart-renderer.ts` | 15.3 |
| 8 | `packages/core/src/skills/builtin/chart-render-skill.ts` | 15.3 |
| 9 | `packages/core/src/skills/builtin/__tests__/chart-renderer.test.ts` | 15.3 |
| 10–38 | `packages/extensions/ext-deal-analyzer/...` (29 files) | 15.4 |

### Modified Files (5)

| File | Subphase | Change |
|------|----------|--------|
| `package.json` | 15.2, 15.3 | Add `pdf-lib`, `chart.js`, `chartjs-node-canvas`, `canvas` |
| `src/main/index.ts` | 15.1–15.4 | Import + register 3 skills, import + register ext-deal-analyzer |
| `electron.vite.config.ts` | 15.3, 15.4 | Add `canvas` to externals, add `@openorbit/ext-deal-analyzer` alias |
| `packages/core/src/skills/skill-catalog.ts` | 15.1–15.3 | Upgrade 3 catalog entries from instruction → tool |
| `docs/phases/README.md` | — | Add Phase 15 row |

## Success Criteria

- [x] `npx vitest run` — all tests pass (existing + new formula/PDF/chart tests)
- [x] `npx electron-vite build` — builds without errors
- [x] Skills appear in `skill:list` with correct categories
- [x] AI tools include `skill_financial_calc`, `skill_pdf_generate`, `skill_chart_render`
- [x] ext-deal-analyzer: deal CRUD, comps add/remove, expenses add/remove
- [x] Analysis: all 9 financial metrics compute correctly
- [x] Comparison: side-by-side for 2–4 deals
- [x] PDF export: valid PDF with metrics, tables, and embedded charts
- [x] GHL linking: deal associated with contact/opportunity
- [x] IPC channels match `/^[a-z-]+:[a-z-]+$/`
