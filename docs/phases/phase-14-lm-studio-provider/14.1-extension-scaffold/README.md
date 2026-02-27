# 14.1: Extension Scaffold

**Effort:** Low | **Status:** Not started

## Background

The LM Studio extension follows the exact same 4-file structure as `ext-ai-ollama`. It's a pure AI provider with no UI views, no IPC handlers, no DB migrations.

## Tasks

### package.json
- [ ] Create `packages/extensions/ext-ai-lm-studio/package.json`
  - `name`: `@openorbit/ext-ai-lm-studio`
  - `openorbit.id`: `ext-ai-lm-studio`
  - `openorbit.displayName`: `LM Studio (Local)`
  - `openorbit.category`: `ai`
  - `openorbit.icon`: `hard-drive`
  - `openorbit.activationEvents`: `["onStartup"]`
  - `contributes.settings`:
    - `lmstudio_base_url` (default: `http://localhost:1234`)
    - `lmstudio_model_fast` (default: empty, auto-detect)
    - `lmstudio_model_standard` (default: empty, auto-detect)
    - `lmstudio_model_premium` (default: empty, auto-detect)

### Main Entry
- [ ] Create `packages/extensions/ext-ai-lm-studio/src/main/index.ts`
  ```typescript
  const extension: ExtensionMainAPI = {
    async activate(ctx: ExtensionContext): Promise<void> {
      const provider = new LmStudioProvider(ctx.log)
      ctx.services.ai.registerProvider(provider)
      ctx.log.info('LM Studio local LLM provider registered')
    }
  }
  ```

### Renderer Stub
- [ ] Create `packages/extensions/ext-ai-lm-studio/src/renderer/index.ts`
  - Stub with empty `activate()` (no renderer views for AI providers)
