import type { Page, ElementHandle } from 'patchright'
import type { SelectorHealer } from './selector-healer'
import { createLogger } from '../utils/logger'

const log = createLogger('PageReader')

export interface ExtractedElement {
  tag: string
  text: string
  href?: string
  ariaLabel?: string
  selector: string
}

export class PageReader {
  private healer: SelectorHealer | null = null

  /** Attach a SelectorHealer for transparent fallback repair */
  setHealer(healer: SelectorHealer): void {
    this.healer = healer
  }

  /** Extract visible text content from a page or a container */
  async getVisibleText(page: Page, containerSelector?: string): Promise<string> {
    return page.evaluate((sel) => {
      const root = sel ? document.querySelector(sel) : document.body
      if (!root) return ''
      return (root.textContent ?? '').replace(/\s+/g, ' ').trim()
    }, containerSelector ?? null)
  }

  /** Extract inner HTML from a container */
  async getInnerHTML(page: Page, selector: string): Promise<string | null> {
    try {
      return await page.locator(selector).first().innerHTML()
    } catch {
      return null
    }
  }

  /** Try multiple selectors in order, return first match text */
  async getTextBySelectors(
    page: Page,
    selectors: string[],
    within?: string
  ): Promise<string | null> {
    for (const sel of selectors) {
      try {
        const fullSel = within ? `${within} ${sel}` : sel
        const el = page.locator(fullSel).first()
        const text = await el.innerText({ timeout: 1000 })
        if (text?.trim()) return text.trim()
      } catch {
        // Try next selector
      }
    }

    // Self-healing fallback
    if (this.healer) {
      const result = await this.tryHealText(page, selectors, within)
      if (result) return result
    }

    return null
  }

  /** Try multiple selectors, return first match href */
  async getHrefBySelectors(
    page: Page,
    selectors: string[],
    within?: string
  ): Promise<string | null> {
    for (const sel of selectors) {
      try {
        const fullSel = within ? `${within} ${sel}` : sel
        const href = await page.locator(fullSel).first().getAttribute('href', { timeout: 1000 })
        if (href) return href
      } catch {
        // Try next selector
      }
    }

    // Self-healing fallback
    if (this.healer) {
      const result = await this.tryHealHref(page, selectors, within)
      if (result) return result
    }

    return null
  }

  /** Check if text content matches any of the given patterns */
  async hasTextMatch(page: Page, selector: string, patterns: string[]): Promise<boolean> {
    try {
      const text = await page.locator(selector).first().innerText({ timeout: 1000 })
      const lower = text?.toLowerCase() ?? ''
      return patterns.some((p) => lower.includes(p.toLowerCase()))
    } catch {
      return false
    }
  }

  /** Get all elements matching a selector within an optional container */
  async getElements(page: Page, selector: string, within?: string): Promise<ElementHandle[]> {
    const fullSel = within ? `${within} ${selector}` : selector
    try {
      return await page.$$(fullSel)
    } catch {
      return []
    }
  }

  /** Count elements matching a selector */
  async countElements(page: Page, selector: string): Promise<number> {
    try {
      return await page.locator(selector).count()
    } catch {
      return 0
    }
  }

  /** Wait for any of the given selectors to appear */
  async waitForAnySelector(
    page: Page,
    selectors: string[],
    timeout = 10000
  ): Promise<string | null> {
    const promises = selectors.map((sel) =>
      page
        .waitForSelector(sel, { timeout, state: 'attached' })
        .then(() => sel)
        .catch(() => null)
    )

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        return result.value
      }
    }

    // Self-healing fallback
    if (this.healer) {
      const repaired = await this.getRepairedSelectors(page, selectors)
      if (repaired) {
        // Try repaired selectors with a shorter timeout
        for (const sel of repaired) {
          try {
            await page.waitForSelector(sel, { timeout: 3000, state: 'attached' })
            return sel
          } catch {
            // Try next
          }
        }
      }
    }

    log.warn('No selector found', { selectors, timeout })
    return null
  }

  /** Extract the current page URL */
  getUrl(page: Page): string {
    return page.url()
  }

  // --- Self-healing helpers ---

  private async getRepairedSelectors(
    page: Page,
    selectors: string[],
    within?: string
  ): Promise<string[] | null> {
    if (!this.healer) return null

    // Try cached repair first
    const cached = this.healer.getCachedRepair(selectors)
    if (cached) return cached

    // Attempt live repair via Claude
    return this.healer.repair(page, selectors, { within })
  }

  private async tryHealText(
    page: Page,
    selectors: string[],
    within?: string
  ): Promise<string | null> {
    const repaired = await this.getRepairedSelectors(page, selectors, within)
    if (!repaired) return null

    for (const sel of repaired) {
      try {
        const fullSel = within ? `${within} ${sel}` : sel
        const el = page.locator(fullSel).first()
        const text = await el.innerText({ timeout: 1000 })
        if (text?.trim()) {
          this.healer!.recordSuccess(selectors)
          return text.trim()
        }
      } catch {
        // Try next
      }
    }

    this.healer!.recordFailure(selectors)
    return null
  }

  private async tryHealHref(
    page: Page,
    selectors: string[],
    within?: string
  ): Promise<string | null> {
    const repaired = await this.getRepairedSelectors(page, selectors, within)
    if (!repaired) return null

    for (const sel of repaired) {
      try {
        const fullSel = within ? `${within} ${sel}` : sel
        const href = await page.locator(fullSel).first().getAttribute('href', { timeout: 1000 })
        if (href) {
          this.healer!.recordSuccess(selectors)
          return href
        }
      } catch {
        // Try next
      }
    }

    this.healer!.recordFailure(selectors)
    return null
  }
}
