import type { Page } from 'patchright'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getCoreConfig, isCoreInitialized } from '../config'
import {
  SELECTOR_SNAPSHOT_MAX_LENGTH,
  SELECTOR_CACHE_MIN_CONFIDENCE,
  SELECTOR_CACHE_MAX_FAILURES,
  SELECTOR_CONFIDENCE_BOOST,
  SELECTOR_CONFIDENCE_PENALTY
} from '../constants'
import type { AIService } from '../ai/provider-types'
import { createLegacyAIService } from '../ai/compat'
import { createLogger } from '../utils/logger'

const log = createLogger('SelectorHealer')

export interface RepairedSelector {
  originalSelectors: string[]
  repairedSelectors: string[]
  confidence: number
  repairedAt: string
  successCount: number
  failureCount: number
}

export interface SelectorCacheFile {
  version: 1
  platform: string
  entries: Record<string, RepairedSelector>
}

interface RepairResponse {
  selectors: string[]
  confidence: number
  reasoning: string
}

export class SelectorHealer {
  private attemptedThisSession = new Set<string>()
  private cache = new Map<string, RepairedSelector>()
  private aiAvailable: boolean | null = null
  private cacheLoaded = false
  private platform: string
  private ai: AIService

  constructor(platform: string, ai?: AIService) {
    this.platform = platform
    this.ai = ai ?? createLegacyAIService()
  }

  static cacheKey(selectors: string[]): string {
    return selectors.slice().sort().join('||')
  }

  getCachedRepair(selectors: string[]): string[] | null {
    this.ensureCacheLoaded()
    const key = SelectorHealer.cacheKey(selectors)
    const entry = this.cache.get(key)
    if (!entry) return null
    if (entry.confidence < SELECTOR_CACHE_MIN_CONFIDENCE) return null
    if (entry.failureCount >= SELECTOR_CACHE_MAX_FAILURES) return null
    return entry.repairedSelectors
  }

  recordSuccess(selectors: string[]): void {
    const key = SelectorHealer.cacheKey(selectors)
    const entry = this.cache.get(key)
    if (!entry) return
    entry.successCount++
    entry.confidence = Math.min(1.0, entry.confidence + SELECTOR_CONFIDENCE_BOOST)
    this.persistCache()
  }

  recordFailure(selectors: string[]): void {
    const key = SelectorHealer.cacheKey(selectors)
    const entry = this.cache.get(key)
    if (!entry) return
    entry.failureCount++
    entry.confidence = Math.max(0, entry.confidence - SELECTOR_CONFIDENCE_PENALTY)
    this.persistCache()
  }

  async repair(
    page: Page,
    selectors: string[],
    context: { fieldName?: string; within?: string }
  ): Promise<string[] | null> {
    const key = SelectorHealer.cacheKey(selectors)

    if (this.attemptedThisSession.has(key)) {
      return null
    }
    this.attemptedThisSession.add(key)

    if (!(await this.isAIAvailable())) {
      return null
    }

    try {
      const snapshot = await this.captureSnapshot(page, context.within)
      if (!snapshot || snapshot.length < 50) {
        log.warn('DOM snapshot too small, skipping repair')
        return null
      }

      const response = await this.callAI(selectors, snapshot, context)
      if (!response || response.selectors.length === 0) {
        log.warn('Claude returned no selectors')
        return null
      }

      const validated = await this.validateSelectors(page, response.selectors, context.within)
      if (validated.length === 0) {
        log.warn('None of Claude-suggested selectors matched the page')
        return null
      }

      const entry: RepairedSelector = {
        originalSelectors: selectors,
        repairedSelectors: validated,
        confidence: response.confidence,
        repairedAt: new Date().toISOString(),
        successCount: 0,
        failureCount: 0
      }
      this.cache.set(key, entry)
      this.persistCache()

      log.info('Selector repaired successfully', {
        original: selectors,
        repaired: validated,
        confidence: response.confidence
      })

      return validated
    } catch (err) {
      log.warn('Selector repair failed', err)
      return null
    }
  }

  async captureSnapshot(page: Page, within?: string): Promise<string> {
    return page.evaluate(
      ({ containerSel, maxLen }) => {
        const root = containerSel
          ? document.querySelector(containerSel) || document.body
          : document.body

        const clone = root.cloneNode(true) as HTMLElement
        clone
          .querySelectorAll('script, style, svg, link[rel="stylesheet"], noscript')
          .forEach((el) => el.remove())

        let html = clone.innerHTML
        html = html.replace(/data:[^"'\s]+/g, 'data:...')
        html = html.replace(/\sstyle="[^"]*"/g, '')
        html = html.replace(/\s{2,}/g, ' ')

        if (html.length > maxLen) {
          html = html.slice(0, maxLen) + '\n<!-- truncated -->'
        }
        return html
      },
      { containerSel: within ?? null, maxLen: SELECTOR_SNAPSHOT_MAX_LENGTH }
    )
  }

  private async callAI(
    failedSelectors: string[],
    domSnapshot: string,
    context: { fieldName?: string }
  ): Promise<RepairResponse | null> {
    const systemPrompt = `You are a CSS selector repair specialist for web scraping.
You will be given:
1. A list of CSS selectors that no longer match any elements
2. A DOM snapshot of the current page
3. Optionally, the field name these selectors were trying to extract

Your job is to analyze the DOM and suggest corrected CSS selectors.

Respond with ONLY valid JSON in this format:
{
  "selectors": ["selector1", "selector2"],
  "confidence": 0.85,
  "reasoning": "Brief explanation"
}

Rules:
- Return 1-3 selectors, ordered by specificity (most specific first)
- Prefer data attributes and semantic selectors over class-based ones
- Class names with hashes (e.g., .css-1abc23) are unstable; avoid them
- Confidence should reflect how sure you are (0.0-1.0)
- If you can't determine good selectors, return empty selectors array with low confidence`

    const userMessage = `## Failed Selectors
${failedSelectors.map((s) => `- \`${s}\``).join('\n')}

${context.fieldName ? `## Target Field\n${context.fieldName}\n` : ''}
## DOM Snapshot
\`\`\`html
${domSnapshot}
\`\`\``

    const result = await this.ai.complete({
      systemPrompt,
      userMessage,
      tier: 'standard',
      maxTokens: 512,
      task: 'repair_hint'
    })

    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    try {
      const parsed = JSON.parse(jsonMatch[0]) as RepairResponse
      if (!Array.isArray(parsed.selectors)) return null
      parsed.selectors = parsed.selectors.filter(
        (s) => typeof s === 'string' && s.length > 0 && s.length < 200
      )
      parsed.confidence =
        typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5
      return parsed
    } catch {
      log.warn('Failed to parse AI repair response', { raw: result.content.slice(0, 200) })
      return null
    }
  }

  private async validateSelectors(
    page: Page,
    selectors: string[],
    within?: string
  ): Promise<string[]> {
    const valid: string[] = []
    for (const sel of selectors) {
      try {
        const fullSel = within ? `${within} ${sel}` : sel
        const count = await page.locator(fullSel).count()
        if (count > 0) {
          valid.push(sel)
        }
      } catch {
        // Invalid selector syntax
      }
    }
    return valid
  }

  private async isAIAvailable(): Promise<boolean> {
    if (this.aiAvailable !== null) return this.aiAvailable
    try {
      // Check if any AI provider is configured
      const providers = this.ai.listProviders()
      this.aiAvailable = providers.some((p) => p.configured)
      if (!this.aiAvailable) {
        // Fallback: check settings directly for legacy callers
        const { SettingsRepo } = await import('../db/settings-repo')
        const settings = new SettingsRepo()
        const keys = settings.getApiKeys()
        this.aiAvailable = keys.length > 0
      }
    } catch {
      this.aiAvailable = false
    }
    return this.aiAvailable
  }

  private getCachePath(): string | null {
    if (!isCoreInitialized()) return null
    const config = getCoreConfig()
    const dir = join(config.hintsDir, 'selector-cache')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    return join(dir, `${this.platform}-selectors.json`)
  }

  private ensureCacheLoaded(): void {
    if (this.cacheLoaded) return
    this.cacheLoaded = true

    const path = this.getCachePath()
    if (!path || !existsSync(path)) return

    try {
      const raw = readFileSync(path, 'utf-8')
      const data = JSON.parse(raw) as SelectorCacheFile
      if (data.version === 1 && data.platform === this.platform) {
        for (const [key, entry] of Object.entries(data.entries)) {
          this.cache.set(key, entry)
        }
        log.info(`Loaded ${this.cache.size} cached selector repairs for ${this.platform}`)
      }
    } catch (err) {
      log.warn('Failed to load selector cache', err)
    }
  }

  private persistCache(): void {
    const path = this.getCachePath()
    if (!path) return

    const data: SelectorCacheFile = {
      version: 1,
      platform: this.platform,
      entries: Object.fromEntries(this.cache.entries())
    }

    try {
      writeFileSync(path, JSON.stringify(data, null, 2))
    } catch (err) {
      log.warn('Failed to persist selector cache', err)
    }
  }

  resetSession(): void {
    this.attemptedThisSession.clear()
  }

  /** Override AI availability check (for testing) */
  setAIAvailable(available: boolean): void {
    this.aiAvailable = available
  }
}
