// ============================================================================
// OpenOrbit — Skill System Type Definitions
//
// A Skill is a generic, reusable capability (PDF generation, calculations,
// email, charts, etc.) that any extension can register and any consumer
// (extension or AI) can invoke.
// ============================================================================

import type { AIToolDefinition } from '../ai/provider-types'

// ---------------------------------------------------------------------------
// Skill categories
// ---------------------------------------------------------------------------

/** Category for grouping skills in the UI */
export type SkillCategory =
  | 'document' // PDF, spreadsheet, CSV export
  | 'communication' // email, SMS, notifications
  | 'data' // calculations, formatting, transformations
  | 'media' // charts, images, audio, transcription
  | 'utility' // general-purpose tools

// ---------------------------------------------------------------------------
// Skill schemas (describe input/output shape)
// ---------------------------------------------------------------------------

/** Describes a single parameter in a skill's input/output schema. */
export interface SkillParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  required?: boolean
  default?: unknown
  properties?: Record<string, SkillParameterSchema>
  items?: SkillParameterSchema
  enum?: string[]
}

/** JSON-schema-like description of a skill's expected input. */
export interface SkillInputSchema {
  type: 'object'
  properties: Record<string, SkillParameterSchema>
  required?: string[]
}

/** JSON-schema-like description of a skill's output. */
export interface SkillOutputSchema {
  type: 'string' | 'object' | 'array'
  description?: string
  properties?: Record<string, SkillParameterSchema>
}

// ---------------------------------------------------------------------------
// Execution result
// ---------------------------------------------------------------------------

/** The result of executing a skill. */
export interface SkillResult {
  /** Whether execution succeeded. */
  success: boolean
  /** The output data (shaped according to outputSchema). */
  data?: unknown
  /** Human-readable summary of what the skill did. */
  summary?: string
  /** Error message if success is false. */
  error?: string
  /** Execution time in milliseconds (set automatically by registry). */
  durationMs?: number
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

/** Capabilities a skill can declare. */
export interface SkillCapabilities {
  /** Whether this skill supports streaming output. */
  streaming?: boolean
  /** Whether this skill requires browser/network access. */
  requiresBrowser?: boolean
  /** Whether this skill can operate offline (no API keys or network). */
  offlineCapable?: boolean
  /** Whether to auto-expose as an AI tool (default true). */
  aiTool?: boolean
}

// ---------------------------------------------------------------------------
// Skill interface — what every skill must implement
// ---------------------------------------------------------------------------

/** The interface every skill must implement. */
export interface Skill {
  /** Unique skill identifier in kebab-case, e.g. 'calc-expression'. */
  readonly id: string
  /** Human-readable name, e.g. 'Calculator'. */
  readonly displayName: string
  /** Description of what this skill does. */
  readonly description: string
  /** Category for grouping. */
  readonly category: SkillCategory
  /** Which extension (or 'shell') registered this skill. */
  readonly extensionId: string
  /** Icon name for the UI (matches SvgIcon names). */
  readonly icon?: string
  /** Skill capabilities. */
  readonly capabilities: SkillCapabilities
  /** JSON schema describing the input parameters. */
  readonly inputSchema: SkillInputSchema
  /** JSON schema describing the output. */
  readonly outputSchema: SkillOutputSchema

  /** Execute the skill with the given input. */
  execute(input: Record<string, unknown>): Promise<SkillResult>

  /** Optional pre-execution validation. */
  validate?(input: Record<string, unknown>): { valid: boolean; errors?: string[] }
}

// ---------------------------------------------------------------------------
// SkillInfo — renderer-safe summary (no execute function)
// ---------------------------------------------------------------------------

/** Renderer-safe summary of a registered skill. */
export interface SkillInfo {
  id: string
  displayName: string
  description: string
  category: SkillCategory
  extensionId: string
  icon?: string
  capabilities: SkillCapabilities
  inputSchema: SkillInputSchema
  outputSchema: SkillOutputSchema
}

// ---------------------------------------------------------------------------
// SkillService — facade exposed via SharedServices.skills
// ---------------------------------------------------------------------------

/** The skill service interface available to extensions via `ctx.services.skills`. */
export interface SkillService {
  /** Register a new skill (called by extensions during activation). */
  registerSkill(skill: Skill): void
  /** Unregister a skill by ID. */
  unregisterSkill(id: string): void
  /** Get a skill by ID. */
  getSkill(id: string): Skill | undefined
  /** List all registered skills (renderer-safe). Filter by category if provided. */
  listSkills(category?: SkillCategory): SkillInfo[]
  /** Execute a skill by ID with given input. */
  execute(skillId: string, input: Record<string, unknown>): Promise<SkillResult>
  /** Get all AI-eligible skills as AIToolDefinition[] for tool-calling providers. */
  toAITools(): AIToolDefinition[]
  /** Enable a skill by ID. */
  enableSkill(id: string): void
  /** Disable a skill by ID. */
  disableSkill(id: string): void
  /** Get the enabled/disabled map for all skills. */
  getEnabledMap(): Record<string, boolean>
  /** Bulk-set the enabled map (used for hydration from settings). */
  setEnabledMap(map: Record<string, boolean>): void
}
