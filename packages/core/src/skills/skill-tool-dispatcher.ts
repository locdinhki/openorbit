// ============================================================================
// OpenOrbit — Skill Tool Dispatcher
//
// Bridges the AI tool calling loop with the Skill Registry.
// When an AI model calls a tool named `skill_*`, this dispatcher
// routes it to the appropriate skill.
// ============================================================================

import type { AIToolCall, AIToolResult, AIToolDefinition } from '../ai/provider-types'
import type { SkillService } from './skill-types'

const SKILL_TOOL_PREFIX = 'skill_'

/** Check whether a tool call targets a skill. */
export function isSkillToolCall(toolName: string): boolean {
  return toolName.startsWith(SKILL_TOOL_PREFIX)
}

/** Convert skill tool name back to skill ID: skill_pdf_generate → pdf-generate */
export function toolNameToSkillId(toolName: string): string {
  return toolName.slice(SKILL_TOOL_PREFIX.length).replace(/_/g, '-')
}

/** Execute a skill tool call and return an AIToolResult. */
export async function executeSkillTool(
  call: AIToolCall,
  skillService: SkillService
): Promise<AIToolResult> {
  const skillId = toolNameToSkillId(call.name)
  try {
    const result = await skillService.execute(skillId, call.input)
    if (result.success) {
      return {
        toolCallId: call.id,
        content: result.summary ?? JSON.stringify(result.data)
      }
    }
    return {
      toolCallId: call.id,
      content: `Error: ${result.error}`,
      isError: true
    }
  } catch (err) {
    return {
      toolCallId: call.id,
      content: `Error: ${err instanceof Error ? err.message : String(err)}`,
      isError: true
    }
  }
}

/** Get combined tool definitions: extension-specific tools + skill tools. */
export function getCombinedTools(
  extensionTools: AIToolDefinition[],
  skillService: SkillService
): AIToolDefinition[] {
  return [...extensionTools, ...skillService.toAITools()]
}
