# 13.4: AI Chat Integration

**Effort:** Low | **Status:** Complete

## Background

When instruction skills are installed, their markdown content should be injected into the AI chat system prompt. This makes the AI aware of the skill's workflow, conventions, and quality gates — enabling it to follow those instructions when relevant.

## Tasks

### System Prompt Injection
- [ ] Modify `packages/extensions/ext-ghl/src/main/ai/ghl-chat-handler.ts`
  - Import `getInstalledInstructionContent` from `@openorbit/core/skills/skill-catalog`
  - In `buildSystemPrompt()` or at the start of `agenticLoop()`, append installed skill instructions:
    ```typescript
    const skillInstructions = getInstalledInstructionContent(settingsRepo, userSkillsRepo)
    if (skillInstructions) {
      systemPrompt += '\n\n## Installed Skills\n\n' + skillInstructions
    }
    ```
  - Pass `SettingsRepo` and `UserSkillsRepo` instances to the chat handler (or pass a combined getter function)

### Minimal Change
- The `getInstalledInstructionContent()` function returns empty string if no instruction skills are installed, so the system prompt is unchanged by default
- Only instruction skills with `isInstalled === true` contribute content
- Built-in tool skills are not affected (they use the tool calling mechanism from Phase 12)

## Key Patterns

### Instruction Content Format

Each instruction skill's content is a markdown document with sections:

```markdown
## Workflow
1. Step one...
2. Step two...

## Conventions
- Convention one...

## Dependencies
- Dependency one...

## Quality Gates
- Quality check one...
```

Multiple installed skills are concatenated with `---` separators.
