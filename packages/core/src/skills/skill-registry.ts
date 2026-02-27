// ============================================================================
// OpenOrbit — Skill Registry
//
// Shell-level registry that manages skills contributed by extensions.
// Extensions call `ctx.services.skills.registerSkill(skill)` during
// activation. Other extensions (or the shell) use
// `ctx.services.skills.execute()` to invoke skills.
//
// Follows the exact same pattern as AIProviderRegistry.
// ============================================================================

import type { Skill, SkillInfo, SkillService, SkillCategory, SkillResult } from './skill-types'
import type { AIToolDefinition } from '../ai/provider-types'
import { createLogger } from '../utils/logger'

const log = createLogger('SkillRegistry')

export class SkillRegistry {
  private skills = new Map<string, Skill>()

  /** Register a new skill. Replaces if already registered. */
  register(skill: Skill): void {
    if (this.skills.has(skill.id)) {
      log.warn(`Skill "${skill.id}" already registered, replacing`)
    }
    this.skills.set(skill.id, skill)
    log.info(`Registered skill: ${skill.displayName} (${skill.id}) [${skill.extensionId}]`)
  }

  /** Unregister a skill by ID. */
  unregister(id: string): void {
    this.skills.delete(id)
    log.info(`Unregistered skill: ${id}`)
  }

  /** Get a skill by ID. */
  get(id: string): Skill | undefined {
    return this.skills.get(id)
  }

  /** List all registered skills, optionally filtered by category. */
  list(category?: SkillCategory): Skill[] {
    const all = [...this.skills.values()]
    if (category) return all.filter((s) => s.category === category)
    return all
  }

  /** List renderer-safe skill summaries, optionally filtered by category. */
  listInfo(category?: SkillCategory): SkillInfo[] {
    return this.list(category).map((s) => ({
      id: s.id,
      displayName: s.displayName,
      description: s.description,
      category: s.category,
      extensionId: s.extensionId,
      capabilities: s.capabilities,
      inputSchema: s.inputSchema,
      outputSchema: s.outputSchema
    }))
  }

  /** Execute a skill by ID. Wraps errors and adds timing automatically. */
  async execute(skillId: string, input: Record<string, unknown>): Promise<SkillResult> {
    const skill = this.skills.get(skillId)
    if (!skill) {
      return { success: false, error: `Skill "${skillId}" not found` }
    }

    // Optional pre-execution validation
    if (skill.validate) {
      const validation = skill.validate(input)
      if (!validation.valid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors?.join(', ') ?? 'unknown error'}`
        }
      }
    }

    const start = Date.now()
    try {
      const result = await skill.execute(input)
      result.durationMs = Date.now() - start
      return result
    } catch (err) {
      const durationMs = Date.now() - start
      const error = err instanceof Error ? err.message : String(err)
      log.error(`Skill "${skillId}" execution failed`, err)
      return { success: false, error, durationMs }
    }
  }

  /**
   * Convert all AI-eligible skills to AIToolDefinition[].
   *
   * Skill IDs are prefixed with `skill_` and hyphens are replaced with
   * underscores to match AI tool naming conventions:
   *   voice-transcribe → skill_voice_transcribe
   */
  toAITools(): AIToolDefinition[] {
    return this.list()
      .filter((s) => s.capabilities.aiTool !== false)
      .map((s) => ({
        name: `skill_${s.id.replace(/-/g, '_')}`,
        description: s.description,
        inputSchema: {
          type: 'object' as const,
          properties: Object.fromEntries(
            Object.entries(s.inputSchema.properties).map(([key, param]) => [
              key,
              {
                type: param.type,
                description: param.description,
                ...(param.enum ? { enum: param.enum } : {})
              }
            ])
          ),
          required: s.inputSchema.required
        }
      }))
  }

  /** Create the SkillService facade for SharedServices. */
  toService(): SkillService {
    return {
      registerSkill: (skill) => this.register(skill),
      unregisterSkill: (id) => this.unregister(id),
      getSkill: (id) => this.get(id),
      listSkills: (category?) => this.listInfo(category),
      execute: (skillId, input) => this.execute(skillId, input),
      toAITools: () => this.toAITools()
    }
  }
}
