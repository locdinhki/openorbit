# 14.3: Shell Integration

**Effort:** Low | **Status:** Not started

## Background

Like all extensions, `ext-ai-lm-studio` needs Vite path aliases and a preloadedModules entry to be bundled and activated by the shell. No changes to `App.tsx` since AI provider extensions have no renderer views.

## Tasks

### Vite Aliases
- [ ] Add to `electron.vite.config.ts` in **both** `main` and `renderer` resolve sections:
  ```typescript
  '@openorbit/ext-ai-lm-studio': resolve('packages/extensions/ext-ai-lm-studio/src')
  ```

### PreloadedModules Registration
- [ ] Add static import to `src/main/index.ts`:
  ```typescript
  import extAiLmStudioMain from '@openorbit/ext-ai-lm-studio/main/index'
  ```
- [ ] Add to `preloadedModules` map (after ext-ai-ollama):
  ```typescript
  ['ext-ai-lm-studio', extAiLmStudioMain]
  ```

### Activation Order

Extension activation order with LM Studio added:
```
ext-ai-claude-sdk → ext-ai-claude → ext-ai-lm-studio → ext-ai-ollama → ext-ai-openai → ext-db-viewer → ext-ghl → ext-jobs → ext-telegram → ext-zillow
```

LM Studio sorts alphabetically between ext-ai-claude and ext-ai-ollama.

### Not Changed
- `src/renderer/src/App.tsx` — no renderer views, no registration needed
- `src/renderer/src/components/Shell/shell-sidebar-items.ts` — no sidebar item
