// ============================================================================
// OpenOrbit — Extension Manifest Validation
// ============================================================================

import { z } from 'zod'
import type { ExtensionManifest } from './types'

const sidebarContributionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().min(1),
  priority: z.number().int()
})

const workspaceContributionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  default: z.boolean().optional()
})

const panelContributionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().min(1)
})

const statusBarContributionSchema = z.object({
  id: z.string().min(1),
  alignment: z.enum(['left', 'right']),
  priority: z.number().int()
})

const toolbarContributionSchema = z.object({
  id: z.string().min(1),
  priority: z.number().int()
})

const commandContributionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1)
})

const settingContributionSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'password']),
  default: z.string().optional(),
  description: z.string().optional()
})

const contributesSchema = z.object({
  sidebar: z.array(sidebarContributionSchema).optional(),
  workspace: z.array(workspaceContributionSchema).optional(),
  panel: z.array(panelContributionSchema).optional(),
  statusBar: z.array(statusBarContributionSchema).optional(),
  toolbar: z.array(toolbarContributionSchema).optional(),
  commands: z.array(commandContributionSchema).optional(),
  settings: z.array(settingContributionSchema).optional()
})

export const extensionManifestSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(
      /^ext-[a-z][a-z0-9-]*$/,
      'Extension ID must start with "ext-" followed by lowercase alphanumeric with hyphens'
    ),
  displayName: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  category: z.enum(['core', 'ai', 'integrations', 'messaging']).optional(),
  icon: z.string().min(1),
  activationEvents: z.array(z.string()).min(1),
  main: z.string().min(1),
  renderer: z.string().min(1),
  contributes: contributesSchema
})

/**
 * Parse and validate the "openorbit" field from an extension's package.json.
 * Returns the validated ExtensionManifest or throws on invalid input.
 */
export function parseManifest(raw: unknown): ExtensionManifest {
  return extensionManifestSchema.parse(raw) as ExtensionManifest
}

/**
 * Safely parse without throwing. Returns { success, data, error }.
 */
export function safeParseManifest(
  raw: unknown
): ReturnType<typeof extensionManifestSchema.safeParse> {
  return extensionManifestSchema.safeParse(raw)
}
