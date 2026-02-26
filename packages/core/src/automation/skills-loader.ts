import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import type { SiteHintFile, ActionStep } from '../types'
import { createLogger } from '../utils/logger'

const log = createLogger('SkillsLoader')

/**
 * Markdown skill file format:
 *
 * ```
 * ---
 * site: linkedin.com/jobs
 * lastFullScan: ""
 * lastVerified: ""
 * ---
 *
 * ## search_jobs
 *
 * ### navigate_to_search
 * - **selectors**: (none)
 * - **textMatches**: (none)
 * - **ariaLabels**: (none)
 * - **location**: url
 * - **elementType**: navigation
 * - **fallback**: Navigate to LinkedIn job search URL with query parameters
 * - **confidence**: 0.95
 * ```
 */

interface MarkdownFrontmatter {
  site: string
  lastFullScan?: string
  lastVerified?: string
}

export class SkillsLoader {
  private cache: Map<string, SiteHintFile> = new Map()
  private searchDirs: string[]

  /**
   * @param searchDirs Directories to search for skill files, in priority order.
   *   Typically: [userData/skills, appRoot/hints]
   */
  constructor(searchDirs: string[]) {
    this.searchDirs = searchDirs
  }

  /** Load a skill file for the given site key (e.g., "linkedin", "indeed"). */
  loadSkill(site: string): SiteHintFile | null {
    const cached = this.cache.get(site)
    if (cached) return cached

    const filePath = this.findSkillFile(site)
    if (!filePath) return null

    const result = filePath.endsWith('.md')
      ? this.parseMarkdownSkill(filePath)
      : this.parseJsonSkill(filePath)

    if (result) {
      this.cache.set(site, result)
    }
    return result
  }

  /** Force reload a skill, clearing cache. */
  reloadSkill(site: string): SiteHintFile | null {
    this.cache.delete(site)
    return this.loadSkill(site)
  }

  /** Clear all cached skills. */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Search for skill file in priority order:
   *   1. {dir}/{site}.md       (each search dir)
   *   2. {dir}/{site}-jobs.md  (each search dir)
   *   3. {dir}/{site}-jobs.json (each search dir)
   */
  private findSkillFile(site: string): string | null {
    const candidates = [`${site}.md`, `${site}-jobs.md`, `${site}-jobs.json`]

    for (const dir of this.searchDirs) {
      for (const filename of candidates) {
        const fullPath = join(dir, filename)
        if (existsSync(fullPath)) {
          log.info('Found skill file', { site, path: fullPath })
          return fullPath
        }
      }
    }

    return null
  }

  /** Parse a markdown skill file with YAML frontmatter. */
  private parseMarkdownSkill(filePath: string): SiteHintFile | null {
    try {
      const content = readFileSync(filePath, 'utf-8')
      return this.parseMarkdownContent(content)
    } catch (err) {
      log.error('Failed to parse markdown skill file', { filePath, error: err })
      return null
    }
  }

  /** Parse markdown content (exported for testing). */
  parseMarkdownContent(content: string): SiteHintFile | null {
    const { frontmatter, body } = this.splitFrontmatter(content)

    if (!frontmatter) {
      log.warn('No YAML frontmatter found in skill file')
      return null
    }

    let meta: MarkdownFrontmatter
    try {
      meta = yaml.load(frontmatter) as MarkdownFrontmatter
    } catch (err) {
      log.error('Invalid YAML frontmatter', { error: err })
      return null
    }

    if (!meta?.site) {
      log.warn('Missing required "site" field in frontmatter')
      return null
    }

    const actions = this.parseActions(body)

    return {
      site: meta.site,
      lastFullScan: meta.lastFullScan || '',
      lastVerified: meta.lastVerified || '',
      actions,
      changeLog: []
    }
  }

  /** Split frontmatter from body. */
  private splitFrontmatter(content: string): { frontmatter: string | null; body: string } {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
    if (!match) {
      return { frontmatter: null, body: content }
    }
    return { frontmatter: match[1], body: match[2] }
  }

  /**
   * Parse the markdown body into actions.
   * Format:
   *   ## action_name
   *   ### step_intent
   *   - **selectors**: sel1, sel2
   *   - **textMatches**: text1, text2
   *   - **ariaLabels**: label1
   *   - **location**: .container
   *   - **elementType**: button
   *   - **fallback**: Description text
   *   - **confidence**: 0.85
   */
  private parseActions(body: string): SiteHintFile['actions'] {
    const actions: SiteHintFile['actions'] = {}
    const lines = body.split('\n')

    let currentAction: string | null = null
    let currentStep: Partial<ActionStep> | null = null
    let currentHint: ActionStep['hint'] | null = null

    const flushStep = (): void => {
      if (currentAction && currentStep?.intent && currentHint) {
        if (!actions[currentAction]) {
          actions[currentAction] = { steps: [] }
        }
        actions[currentAction].steps.push({
          intent: currentStep.intent,
          hint: currentHint,
          fallbackDescription: currentStep.fallbackDescription || '',
          lastVerified: currentStep.lastVerified || '',
          confidence: currentStep.confidence ?? 0.8,
          failureCount: currentStep.failureCount ?? 0
        })
      }
      currentStep = null
      currentHint = null
    }

    for (const line of lines) {
      const trimmed = line.trim()

      // ## action_name
      if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
        flushStep()
        currentAction = trimmed.slice(3).trim()
        continue
      }

      // ### step_intent
      if (trimmed.startsWith('### ')) {
        flushStep()
        currentStep = { intent: trimmed.slice(4).trim() }
        currentHint = {
          selectors: [],
          textMatches: [],
          ariaLabels: [],
          location: '',
          elementType: ''
        }
        continue
      }

      // - **key**: value
      if (trimmed.startsWith('- **') && currentStep && currentHint) {
        const keyMatch = trimmed.match(/^- \*\*(\w+)\*\*:\s*(.*)$/)
        if (!keyMatch) continue

        const key = keyMatch[1]
        const value = keyMatch[2].trim()

        switch (key) {
          case 'selectors':
            currentHint.selectors = this.parseList(value)
            break
          case 'textMatches':
            currentHint.textMatches = this.parseList(value)
            break
          case 'ariaLabels':
            currentHint.ariaLabels = this.parseList(value)
            break
          case 'location':
            currentHint.location = value
            break
          case 'elementType':
            currentHint.elementType = value
            break
          case 'fallback':
            currentStep.fallbackDescription = value
            break
          case 'confidence':
            currentStep.confidence = parseFloat(value) || 0.8
            break
          case 'failureCount':
            currentStep.failureCount = parseInt(value, 10) || 0
            break
        }
      }
    }

    // Flush final step
    flushStep()

    return actions
  }

  /** Parse a comma-separated list, handling "(none)" as empty. */
  private parseList(value: string): string[] {
    if (!value || value === '(none)' || value === 'none' || value === '-') {
      return []
    }
    // Support backtick-wrapped selectors: `sel1`, `sel2`
    return value
      .split(',')
      .map((s) => s.trim().replace(/^`|`$/g, ''))
      .filter(Boolean)
  }

  /** Parse a JSON skill file (backward compatibility). */
  private parseJsonSkill(filePath: string): SiteHintFile | null {
    try {
      const content = readFileSync(filePath, 'utf-8')
      return JSON.parse(content) as SiteHintFile
    } catch (err) {
      log.error('Failed to parse JSON skill file', { filePath, error: err })
      return null
    }
  }
}
