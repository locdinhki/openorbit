import type { Page } from 'patchright'
import type {
  ActionExecutor,
  ActionResult,
  PageContext,
  SiteHintFile,
  ActionStep
} from '../types'
import { HINT_CONFIDENCE_THRESHOLD, HINT_SELECTOR_TIMEOUT } from '../constants'
import { createLogger } from '../utils/logger'

const log = createLogger('HintExecutor')

export class HintBasedExecutor implements ActionExecutor {
  private hints: Map<string, SiteHintFile> = new Map()

  loadHints(site: string, hintFile: SiteHintFile): void {
    this.hints.set(site, hintFile)
  }

  getHints(site: string): SiteHintFile | undefined {
    return this.hints.get(site)
  }

  async execute(intent: string, context: PageContext): Promise<ActionResult> {
    const page = context.page as Page
    const site = context.site

    // Find matching hint file
    const hintFile = this.findHintFile(site)
    if (!hintFile) {
      log.warn('No hint file for site', { site })
      return {
        success: false,
        method: 'hint',
        needsEscalation: true,
        errorMessage: `No hints for ${site}`
      }
    }

    // Find matching action
    const action = hintFile.actions[intent]
    if (!action) {
      log.warn('No hint for intent', { site, intent })
      return {
        success: false,
        method: 'hint',
        needsEscalation: true,
        errorMessage: `No hint for intent: ${intent}`
      }
    }

    // Execute each step in sequence
    for (const step of action.steps) {
      if (step.confidence < HINT_CONFIDENCE_THRESHOLD) {
        log.warn('Step confidence below threshold', {
          intent: step.intent,
          confidence: step.confidence
        })
        return {
          success: false,
          method: 'hint',
          needsEscalation: true,
          errorMessage: `Low confidence: ${step.confidence}`
        }
      }

      const result = await this.executeStep(page, step)
      if (!result.success) {
        return result
      }
    }

    return { success: true, method: 'hint' }
  }

  /** Execute a single hint step by trying selectors in order */
  async executeStep(page: Page, step: ActionStep): Promise<ActionResult> {
    for (const selector of step.hint.selectors) {
      try {
        const el = page.locator(selector).first()
        const visible = await el.isVisible({ timeout: HINT_SELECTOR_TIMEOUT })

        if (visible) {
          log.info('Found element via hint', { intent: step.intent, selector })
          return {
            success: true,
            method: 'hint',
            selector,
            label: step.intent
          }
        }
      } catch {
        // Try next selector
      }
    }

    // Try aria labels
    for (const label of step.hint.ariaLabels) {
      try {
        const el = page.getByLabel(label).first()
        const visible = await el.isVisible({ timeout: HINT_SELECTOR_TIMEOUT })
        if (visible) {
          log.info('Found element via aria label', { intent: step.intent, label })
          return { success: true, method: 'hint', label, selector: `[aria-label="${label}"]` }
        }
      } catch {
        // Try next
      }
    }

    // Try text matches
    for (const text of step.hint.textMatches) {
      try {
        const el = page.getByText(text, { exact: false }).first()
        const visible = await el.isVisible({ timeout: HINT_SELECTOR_TIMEOUT })
        if (visible) {
          log.info('Found element via text match', { intent: step.intent, text })
          return { success: true, method: 'hint', text }
        }
      } catch {
        // Try next
      }
    }

    log.warn('All selectors failed for step', { intent: step.intent })
    return {
      success: false,
      method: 'hint',
      needsEscalation: true,
      errorMessage: `No matching element for: ${step.fallbackDescription}`
    }
  }

  /** Find the best hint file for a given hostname */
  private findHintFile(hostname: string): SiteHintFile | undefined {
    // Direct match
    if (this.hints.has(hostname)) return this.hints.get(hostname)

    // Partial match (e.g., "www.linkedin.com" matches "linkedin.com/jobs")
    for (const [site, hints] of this.hints.entries()) {
      if (
        hostname.includes(site.split('/')[0]) ||
        site.split('/')[0].includes(hostname.replace('www.', ''))
      ) {
        return hints
      }
    }

    return undefined
  }
}
