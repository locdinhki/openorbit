# 12.4: AI Chat Integration

**Effort:** Low | **Status:** Complete

## Background

The GHL chat handler (`ghl-chat-handler.ts`) already implements an agentic loop with `completeWithTools`. Skills need to be merged into the available tools so the AI can invoke them alongside extension-specific tools.

## Tasks

### GHL Chat Handler Update
- [x] Accept optional `SkillService` in `GhlChatHandler` constructor (backward-compatible)
- [x] In agentic loop: use `getCombinedTools(GHL_TOOLS, this.skills)` instead of just `GHL_TOOLS`
- [x] In `dispatchTool()`: check `isSkillToolCall(name)` first, delegate to `executeSkillTool()`
- [x] Pass `ctx.services.skills` when constructing `GhlChatHandler` in `ext-ghl/src/main/ipc-handlers.ts`

## How It Works

```
User: "What is the ARV margin if purchase price is $180,000 and ARV is $250,000?"

AI sees tools: [list_contacts, get_contact, ..., skill_calc_expression]

AI calls: skill_calc_expression({ expression: "(250000 - 180000) / 250000 * 100" })

Dispatcher: isSkillToolCall("skill_calc_expression") → true
            toolNameToSkillId("skill_calc_expression") → "calc-expression"
            skillService.execute("calc-expression", { expression: "..." })

Result: { success: true, data: { result: 28, expression: "..." }, summary: "... = 28" }

AI responds: "The ARV margin is 28% ($70,000 spread on a $250,000 ARV)."
```

## Backward Compatibility

The `SkillService` parameter is optional. If not provided, the chat handler works exactly as before with only extension-specific tools.
