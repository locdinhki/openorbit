import type { Page, ElementHandle } from 'patchright'
import { PageReader } from '@openorbit/core/automation/page-reader'
import { SelectorHealer } from '@openorbit/core/automation/selector-healer'
import { HumanBehavior } from '@openorbit/core/automation/human-behavior'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('LinkedInExtractor')

// Selectors for LinkedIn job search results
const SELECTORS = {
  // Job card containers
  jobCards: [
    '.job-card-container',
    '.jobs-search-results__list-item',
    'li[data-occludable-job-id]',
    '.scaffold-layout__list-item'
  ],
  // Title within a card
  cardTitle: [
    '.job-card-list__title',
    'a.job-card-container__link',
    '.artdeco-entity-lockup__title a',
    'a[class*="job-card-list__title"]'
  ],
  // Company within a card
  cardCompany: [
    '.job-card-container__primary-description',
    '.artdeco-entity-lockup__subtitle',
    '.job-card-container__company-name'
  ],
  // Location within a card
  cardLocation: [
    '.job-card-container__metadata-item',
    '.artdeco-entity-lockup__caption',
    '.job-card-container__metadata-wrapper li'
  ],
  // Easy Apply indicator
  easyApply: [
    '.job-card-container__apply-method',
    '[class*="easy-apply"]',
    '.job-card-container__footer-item'
  ],
  // Detail panel (right side)
  detailPanel: [
    '.jobs-search__job-details',
    '.scaffold-layout__detail',
    '.job-details-jobs-unified-top-card'
  ],
  // Description in detail panel
  detailDescription: [
    '#job-details',
    '.jobs-description__content',
    '.jobs-description-content__text',
    '.jobs-box__html-content',
    'article[class*="jobs-description"]',
    '.jobs-description',
    'div[class*="description__text"]',
    '.job-details-about-the-job-module'
  ],
  // Title in detail panel
  detailTitle: [
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title',
    'h1 a',
    'h2.job-details-jobs-unified-top-card__job-title'
  ],
  // Company in detail panel
  detailCompany: [
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name'
  ],
  // Salary in detail panel
  detailSalary: [
    '.job-details-jobs-unified-top-card__job-insight span',
    '[class*="salary"]',
    '.compensation__salary'
  ],
  // Posted date in detail panel
  detailPostedDate: [
    '.job-details-jobs-unified-top-card__primary-description-container span',
    'time',
    '.jobs-unified-top-card__posted-date'
  ]
}

export interface ExtractedCard {
  externalId: string
  title: string
  company: string
  location: string
  url: string
  easyApply: boolean
  element: ElementHandle
}

export class LinkedInExtractor {
  private reader = new PageReader()
  private behavior = new HumanBehavior()
  private healer = new SelectorHealer('linkedin')

  constructor() {
    this.reader.setHealer(this.healer)
  }

  /** Extract all job cards from the search results page */
  async extractJobCards(page: Page): Promise<ExtractedCard[]> {
    const cards: ExtractedCard[] = []
    const extractedIds = new Set<string>()

    // Find job card elements using standard selectors
    let cardElements: ElementHandle[] = []
    for (const sel of SELECTORS.jobCards) {
      cardElements = await page.$$(sel)
      if (cardElements.length > 0) {
        log.info(`Found ${cardElements.length} job cards using: ${sel}`)
        break
      }
    }

    // Extract from currently visible/rendered cards
    for (const el of cardElements) {
      try {
        const card = await this.extractSingleCard(page, el)
        if (card) {
          cards.push(card)
          extractedIds.add(card.externalId)
        }
      } catch (err) {
        log.warn('Failed to extract card', err)
      }
    }

    // Handle virtual-scroll occlusion: LinkedIn hides content of off-screen items.
    // Check if there are list items whose content we haven't extracted yet.
    const allJobIds = await page
      .$$eval('li[data-occludable-job-id]', (els) =>
        els.map((el) => el.getAttribute('data-occludable-job-id') || '').filter(Boolean)
      )
      .catch(() => [] as string[])

    const missingIds = allJobIds.filter((id) => !extractedIds.has(id))

    if (missingIds.length > 0) {
      log.info(`${missingIds.length} occluded items, scrolling to extract`)

      for (const id of missingIds) {
        try {
          // Scroll the item into view to trigger content rendering
          await page.evaluate((jobId) => {
            const el = document.querySelector(`li[data-occludable-job-id="${jobId}"]`)
            if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' })
          }, id)
          await this.behavior.delay(250, 450)

          // Try to extract the now-visible card
          const el = await page.$(`li[data-occludable-job-id="${id}"]`)
          if (!el) continue

          const card = await this.extractSingleCard(page, el)
          if (card) {
            cards.push(card)
            extractedIds.add(card.externalId)
          } else {
            // Content still not rendered — use minimal data with constructed URL
            cards.push({
              externalId: id,
              title: '',
              company: '',
              location: '',
              url: `https://www.linkedin.com/jobs/view/${id}/`,
              easyApply: false,
              element: el
            })
          }
        } catch (err) {
          log.warn(`Failed to extract occluded card ${id}`, err)
        }
      }
    }

    log.info(
      `Extracted ${cards.length} cards (${allJobIds.length || cardElements.length} total items)`
    )
    return cards
  }

  /** Extract data from a single job card element */
  private async extractSingleCard(_page: Page, el: ElementHandle): Promise<ExtractedCard | null> {
    // Get external ID from data attribute or href
    const jobId =
      (await el.getAttribute('data-occludable-job-id')) ??
      (await el.getAttribute('data-job-id')) ??
      (await this.extractJobIdFromHref(el))

    if (!jobId) {
      return null
    }

    // Title
    let title = ''
    for (const sel of SELECTORS.cardTitle) {
      try {
        const titleEl = await el.$(sel)
        if (titleEl) {
          title = ((await titleEl.innerText()) ?? '').trim()
          if (title) break
        }
      } catch {
        /* try next */
      }
    }

    // Company
    let company = ''
    for (const sel of SELECTORS.cardCompany) {
      try {
        const compEl = await el.$(sel)
        if (compEl) {
          company = ((await compEl.innerText()) ?? '').trim()
          if (company) break
        }
      } catch {
        /* try next */
      }
    }

    // Location
    let location = ''
    for (const sel of SELECTORS.cardLocation) {
      try {
        const locEl = await el.$(sel)
        if (locEl) {
          location = ((await locEl.innerText()) ?? '').trim()
          if (location) break
        }
      } catch {
        /* try next */
      }
    }

    // Easy Apply
    let easyApply = false
    const cardText = ((await el.innerText()) ?? '').toLowerCase()
    if (cardText.includes('easy apply')) {
      easyApply = true
    }

    // URL
    let url = ''
    for (const sel of SELECTORS.cardTitle) {
      try {
        const linkEl = await el.$(sel)
        if (linkEl) {
          const href = await linkEl.getAttribute('href')
          if (href) {
            url = href.startsWith('http') ? href : `https://www.linkedin.com${href}`
            break
          }
        }
      } catch {
        /* try next */
      }
    }

    if (!title) {
      return null
    }

    return {
      externalId: jobId,
      title,
      company,
      location,
      url,
      easyApply,
      element: el
    }
  }

  /** Extract full job details from the job page.
   *
   * Strategy (per field):
   *   1. Try hardcoded selectors quickly (no API call)
   *   2. Try cached repaired selectors from SelectorHealer (no API call)
   *   3. If both fail → ask Claude once per session to suggest new selectors
   *   4. DOM heuristic fallback as last resort (description only)
   *
   * Repaired selectors are cached to disk, so future jobs benefit immediately.
   */
  async extractJobDetails(page: Page): Promise<{
    description: string
    salary?: string
    postedDate: string
    title?: string
    company?: string
  }> {
    // Short wait for content to render (page already loaded via goto)
    await this.behavior.delay(800, 1500)

    // --- Description ---
    let description = await this.quickText(page, SELECTORS.detailDescription)
    if (!description) {
      description = await this.healAndExtract(page, SELECTORS.detailDescription, 'description')
    }
    if (!description) {
      description = await this.fallbackExtractDescription(page)
      if (description) {
        log.info(`Fallback extracted description (${description.length} chars)`)
      }
    }

    // --- Salary ---
    let salary = await this.quickSalary(page)
    if (!salary) {
      const healed = await this.healAndExtract(page, SELECTORS.detailSalary, 'salary')
      if (healed && (healed.includes('$') || healed.includes('/yr') || healed.includes('/hr'))) {
        salary = healed
      }
    }

    // --- Posted date ---
    let postedDate = await this.quickPostedDate(page)
    if (!postedDate) {
      const healed = await this.healAndExtract(page, SELECTORS.detailPostedDate, 'posted date')
      if (healed && (healed.includes('ago') || healed.includes('hour') || healed.includes('day'))) {
        postedDate = healed
      }
    }

    // Skip detail title/company — card data is more reliable than
    // innerText() on LinkedIn's nested title elements which often
    // returns duplicated text like "Title Title with verification".

    return { description, salary, postedDate }
  }

  /**
   * Try cached healer repairs, then trigger live Claude repair if needed.
   * Returns extracted text or empty string. At most one Claude API call
   * per selector group per session (enforced by SelectorHealer).
   */
  private async healAndExtract(
    page: Page,
    selectors: string[],
    fieldName: string
  ): Promise<string> {
    // Step 1: Check disk cache for previously repaired selectors (no API call)
    const cached = this.healer.getCachedRepair(selectors)
    if (cached) {
      const text = await this.quickText(page, cached)
      if (text) {
        this.healer.recordSuccess(selectors)
        log.info(`Cached repair hit for ${fieldName}`, { selectors: cached })
        return text
      }
      this.healer.recordFailure(selectors)
    }

    // Step 2: Ask Claude for new selectors (once per session per selector group)
    const repaired = await this.healer.repair(page, selectors, { fieldName })
    if (repaired) {
      const text = await this.quickText(page, repaired)
      if (text) {
        log.info(`Live repair succeeded for ${fieldName}`, { selectors: repaired })
        return text
      }
    }

    return ''
  }

  /** Try selectors quickly without triggering SelectorHealer */
  private async quickText(page: Page, selectors: string[]): Promise<string> {
    for (const sel of selectors) {
      try {
        const el = page.locator(sel).first()
        const text = await el.innerText({ timeout: 1500 })
        if (text?.trim()) return text.trim()
      } catch {
        /* try next */
      }
    }
    return ''
  }

  /** Extract salary from known selectors — no healing */
  private async quickSalary(page: Page): Promise<string | undefined> {
    for (const sel of SELECTORS.detailSalary) {
      try {
        const elements = await page.$$(sel)
        for (const el of elements) {
          const text = ((await el.innerText()) ?? '').trim()
          if (text && (text.includes('$') || text.includes('/yr') || text.includes('/hr'))) {
            return text
          }
        }
      } catch {
        /* try next */
      }
    }
    // Fallback: scan all text for salary patterns
    try {
      return await page.evaluate(() => {
        const allText = document.body.innerText
        const match = allText.match(/\$[\d,]+(?:\/yr|\/hr|K?\s*-\s*\$[\d,]+(?:\/yr|\/hr|K)?)/i)
        return match ? match[0] : undefined
      })
    } catch {
      return undefined
    }
  }

  /** Extract posted date from known selectors — no healing */
  private async quickPostedDate(page: Page): Promise<string> {
    for (const sel of SELECTORS.detailPostedDate) {
      try {
        const elements = await page.$$(sel)
        for (const el of elements) {
          const text = ((await el.innerText()) ?? '').trim().toLowerCase()
          if (
            text.includes('ago') ||
            text.includes('hour') ||
            text.includes('day') ||
            text.includes('week') ||
            text.includes('reposted')
          ) {
            return text
          }
        }
      } catch {
        /* try next */
      }
    }
    return ''
  }

  /** Click a job card to load its details */
  async clickJobCard(page: Page, card: ExtractedCard): Promise<void> {
    try {
      // Try clicking the title link within the card
      for (const sel of SELECTORS.cardTitle) {
        const linkEl = await card.element.$(sel)
        if (linkEl) {
          await linkEl.click()
          return
        }
      }
      // Fallback: click the card element itself
      await card.element.click()
    } catch {
      // Last resort: navigate directly
      if (card.url) {
        await page.goto(card.url, { waitUntil: 'domcontentloaded' })
      }
    }
  }

  /**
   * Fallback: find the largest text block inside the detail panel area.
   * LinkedIn frequently changes class names but the description is always
   * the longest prose block in the right-side detail pane.
   */
  private async fallbackExtractDescription(page: Page): Promise<string> {
    try {
      const text = await page.evaluate(() => {
        // Look within the detail/right panel area
        const containers = [
          document.querySelector('.scaffold-layout__detail'),
          document.querySelector('.jobs-search__job-details'),
          document.querySelector('[class*="job-details"]'),
          document.querySelector('.job-view-layout')
        ].filter(Boolean) as Element[]

        const root = containers[0] || document.body
        // Find the element with the longest innerText (likely the description)
        let best = ''
        const candidates = root.querySelectorAll('div, section, article, span')
        for (const el of candidates) {
          const t = (el.textContent ?? '').trim()
          // Descriptions are usually 100+ chars; skip nav/buttons/headers
          if (t.length > best.length && t.length > 100) {
            // Make sure it's a leaf-ish block (not a massive parent that includes everything)
            const childBlocks = el.querySelectorAll('div, section, article')
            const isLeafy = childBlocks.length < 5
            if (isLeafy) {
              best = t
            }
          }
        }
        return best
      })
      return text
    } catch (err) {
      log.warn('Fallback description extraction failed', err)
      return ''
    }
  }

  private async extractJobIdFromHref(el: ElementHandle): Promise<string | null> {
    try {
      const links = await el.$$('a')
      for (const link of links) {
        const href = await link.getAttribute('href')
        if (href) {
          // LinkedIn job URLs contain /jobs/view/XXXXXXX/ or currentJobId=XXXXXXX
          const viewMatch = href.match(/\/jobs\/view\/(\d+)/)
          if (viewMatch) return viewMatch[1]

          const paramMatch = href.match(/currentJobId=(\d+)/)
          if (paramMatch) return paramMatch[1]
        }
      }
    } catch {
      /* ignore */
    }
    return null
  }
}
