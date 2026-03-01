# 15.3: Charts & Visualization Skill

**Effort:** Medium | **Depends on:** Phase 12 (Skill System) | **Status:** Complete

## Goal

Add a built-in tool skill for server-side chart rendering to PNG using `chartjs-node-canvas`. Enables embedding charts in PDFs (via the PDF skill) and generating visualizations from the main process without a renderer window.

## Skill Definition

- **id:** `chart-render`
- **category:** `media`
- **icon:** `bar-chart`
- **capabilities:** `{ aiTool: true, offlineCapable: true, streaming: false }`
- **AI tool name:** `skill_chart_render`

### Input Schema

```typescript
{
  type: 'bar' | 'line' | 'pie' | 'doughnut',
  title?: string,
  labels: string[],
  datasets: [
    {
      label: string,
      data: number[],
      backgroundColor?: string | string[],
      borderColor?: string | string[]
    }
  ],
  width?: number,   // default 800
  height?: number,  // default 400
}
```

### Output

```typescript
{
  base64: string,           // PNG as base64 string
  width: number,
  height: number,
  mimeType: 'image/png'
}
```

## Design Notes

- **Default color palette:** professional 6-color palette applied automatically when colors are not specified
- **Lazy initialization:** `ChartJSNodeCanvas` instance created on first use and cached for reuse
- **Native dependency:** `canvas` (node-canvas) requires `electron-rebuild`, same pattern as `better-sqlite3`. Added to `rollupOptions.external` so it's loaded at runtime, not bundled.

## New Files

| File | Purpose |
|------|---------|
| `packages/core/src/skills/builtin/chart-renderer.ts` | ChartJSNodeCanvas wrapper with default palette, lazy init |
| `packages/core/src/skills/builtin/chart-render-skill.ts` | `createChartRenderSkill(extensionId): Skill` |
| `packages/core/src/skills/builtin/__tests__/chart-renderer.test.ts` | Unit tests |

## Modified Files

| File | Change |
|------|--------|
| `package.json` | Add `chart.js`, `chartjs-node-canvas`, `canvas` |
| `electron.vite.config.ts` | Add `'canvas'` to `rollupOptions.external` |
| `src/main/index.ts` | Import + register |
| `packages/core/src/skills/skill-catalog.ts` | Change `charts-visualization` entry: `type: 'tool'`, `isBuiltIn: true`, remove `content` |

## Success Criteria

- [x] `canvas` builds via `electron-rebuild`
- [x] Skill produces valid PNG bytes (magic bytes `\x89PNG`)
- [x] Bar, line, pie, and doughnut charts all render correctly
- [x] Default color palette produces professional-looking charts
- [x] Generated PNGs embed correctly when passed to the PDF skill's `image` section
- [x] `npx vitest run` passes
