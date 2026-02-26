/**
 * SkillsManager — install, remove, and list community skills from the registry.
 *
 * Community skills are YAML files hosted at the openorbit/skills-registry GitHub repo
 * and installed to {dataDir}/skills/community/<name>.yaml.
 *
 * The same SkillsLoader that loads built-in hints picks up community skills when
 * the community directory is included in the search path.
 */

import { mkdirSync, writeFileSync, rmSync, readdirSync, existsSync } from 'fs'
import { join, homedir } from 'path'

export const REGISTRY_URL =
  'https://raw.githubusercontent.com/openorbit/skills-registry/main/index.json'

export interface SkillMeta {
  /** Package-style name, e.g. "@community/glassdoor" */
  name: string
  version: string
  description: string
  /** Direct URL to the raw YAML file */
  url: string
  author: string
  /** Hostname pattern this skill targets, e.g. "glassdoor.com" */
  platform: string
}

export interface SkillRegistry {
  skills: SkillMeta[]
  updatedAt: string
}

// ---------------------------------------------------------------------------
// Platform-aware data directory (mirrors Electron's userData + /data)
// ---------------------------------------------------------------------------

export function getDataDir(): string {
  const home = homedir()
  switch (process.platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'openorbit', 'data')
    case 'win32':
      return join(
        process.env['APPDATA'] ?? join(home, 'AppData', 'Roaming'),
        'openorbit',
        'data'
      )
    default:
      return join(process.env['XDG_CONFIG_HOME'] ?? join(home, '.config'), 'openorbit', 'data')
  }
}

// ---------------------------------------------------------------------------
// SkillsManager
// ---------------------------------------------------------------------------

export class SkillsManager {
  readonly communityDir: string

  constructor(dataDir?: string) {
    const base = dataDir ?? getDataDir()
    this.communityDir = join(base, 'skills', 'community')
  }

  /** Fetch the registry index from GitHub. */
  async fetchRegistry(): Promise<SkillRegistry> {
    const res = await fetch(REGISTRY_URL)
    if (!res.ok) {
      throw new Error(`Failed to fetch skills registry (HTTP ${res.status})`)
    }
    return res.json() as Promise<SkillRegistry>
  }

  /**
   * Download and install a skill by name (e.g. "@community/glassdoor").
   * Validates the YAML before writing.
   */
  async install(name: string): Promise<SkillMeta> {
    const registry = await this.fetchRegistry()
    const skill = registry.skills.find((s) => s.name === name)
    if (!skill) {
      const available = registry.skills.map((s) => s.name).join(', ')
      throw new Error(`Skill '${name}' not found in registry.\nAvailable: ${available}`)
    }

    const res = await fetch(skill.url)
    if (!res.ok) {
      throw new Error(`Failed to download skill '${name}' (HTTP ${res.status})`)
    }
    const content = await res.text()

    this.validateSkillContent(name, content)

    mkdirSync(this.communityDir, { recursive: true })
    writeFileSync(join(this.communityDir, this.toFilename(name)), content, 'utf-8')
    return skill
  }

  /** Remove an installed community skill. */
  remove(name: string): void {
    const path = join(this.communityDir, this.toFilename(name))
    if (!existsSync(path)) {
      throw new Error(`Skill '${name}' is not installed`)
    }
    rmSync(path)
  }

  /** List all installed community skills. */
  list(): string[] {
    if (!existsSync(this.communityDir)) return []
    return readdirSync(this.communityDir)
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.md'))
      .map((f) => `@community/${f.replace(/\.(yaml|md)$/, '')}`)
  }

  /** Convert skill name like "@community/glassdoor" → "glassdoor.yaml" */
  toFilename(name: string): string {
    const base = name.replace(/^@community\//, '').replace(/\//g, '-')
    return `${base}.yaml`
  }

  /**
   * Validate that skill content looks like a valid OpenOrbit skill file.
   * A valid skill must have a "site:" field in the YAML frontmatter (either
   * as a standalone YAML doc or embedded in Markdown frontmatter).
   */
  validateSkillContent(name: string, content: string): void {
    const trimmed = content.trim()

    // Markdown with frontmatter: ---\nsite: ...\n---
    // OR plain YAML: site: ...
    const sitePattern = /^site:\s+\S/m
    if (!sitePattern.test(trimmed)) {
      throw new Error(
        `Skill '${name}' is invalid: missing required "site:" field in YAML/frontmatter`
      )
    }
  }
}
