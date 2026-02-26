import type { Page } from 'patchright'
import { PageReader } from '@openorbit/core/automation/page-reader'
import { SelectorHealer } from '@openorbit/core/automation/selector-healer'
import { HumanBehavior } from '@openorbit/core/automation/human-behavior'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('IndeedExtractor')

const SELECTORS = {
  jobCards: ['.job_seen_beacon', '.resultContent', '.cardOutline', '[data-jk]', 'li.css-1ac2h1y'],
  cardTitle: ['.jobTitle a', 'h2.jobTitle span', 'a[data-jk] span[title]', '.jcs-JobTitle span'],
  cardCompany: [
    '[data-testid="company-name"]',
    '.companyName',
    '.company_location .companyName',
    'span.css-92r8pb'
  ],
  cardLocation: [
    '[data-testid="text-location"]',
    '.companyLocation',
    '.company_location .companyLocation',
    '.css-1p0sjhy'
  ],
  detailDescription: [
    '#jobDescriptionText',
    '.jobsearch-JobComponent-description',
    '[id="jobDescriptionText"]',
    '.jobsearch-jobDescriptionText',
    '#jobDescription',
    '.jobsearch-BodyContainer',
    'div[class*="jobDescription"]',
    '[data-testid="jobDescriptionText"]'
  ],
  detailSalary: [
    '#salaryInfoAndJobType',
    '[data-testid="attribute_snippet_testid"]',
    '.salary-snippet-container',
    '.css-1bkk2ja'
  ]
}

export interface IndeedExtractedCard {
  externalId: string
  title: string
  company: string
  location: string
  url: string
}

export class IndeedExtractor {
  private reader = new PageReader()
  private behavior = new HumanBehavior()
  private healer = new SelectorHealer('indeed')

  constructor() {
    this.reader.setHealer(this.healer)
  }

  /** Extract all job cards from Indeed search results */
  async extractJobCards(page: Page): Promise<IndeedExtractedCard[]> {
    const cards: IndeedExtractedCard[] = []

    let cardElements: Awaited<ReturnType<Page['$$']>> = []
    for (const sel of SELECTORS.jobCards) {
      cardElements = await page.$$(sel)
      if (cardElements.length > 0) {
        log.info(`Found ${cardElements.length} job cards using: ${sel}`)
        break
      }
    }

    if (cardElements.length === 0) {
      log.warn('No job cards found on page')
      return cards
    }

    for (const el of cardElements) {
      try {
        // Extract job key (Indeed uses data-jk attribute)
        const jobKey = (await el.getAttribute('data-jk')) ?? (await this.extractJobKeyFromLink(el))
        if (!jobKey) continue

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
        if (!title) continue

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

        // URL
        let url = ''
        try {
          const linkEl = await el.$('a[data-jk], .jobTitle a, h2.jobTitle a')
          if (linkEl) {
            const href = await linkEl.getAttribute('href')
            if (href) {
              url = href.startsWith('http') ? href : `https://www.indeed.com${href}`
            }
          }
        } catch {
          /* ignore */
        }
        if (!url) {
          url = `https://www.indeed.com/viewjob?jk=${jobKey}`
        }

        cards.push({ externalId: jobKey, title, company, location, url })
      } catch (err) {
        log.warn('Failed to extract card', err)
      }
    }

    log.info(`Extracted ${cards.length} cards from ${cardElements.length} elements`)
    return cards
  }

  /** Extract job details from Indeed detail panel/page */
  async extractJobDetails(page: Page): Promise<{
    description: string
    salary?: string
    title?: string
  }> {
    await this.behavior.delay(500, 1000)

    let description =
      (await this.reader.getTextBySelectors(page, SELECTORS.detailDescription)) ?? ''

    if (!description) {
      log.info('Known selectors failed for description, trying fallback extraction')
      description = await this.fallbackExtractDescription(page)
    }

    let salary: string | undefined
    for (const sel of SELECTORS.detailSalary) {
      try {
        const elements = await page.$$(sel)
        for (const el of elements) {
          const text = ((await el.innerText()) ?? '').trim()
          if (text && (text.includes('$') || text.includes('/yr') || text.includes('/hr'))) {
            salary = text
            break
          }
        }
        if (salary) break
      } catch {
        /* try next */
      }
    }

    // Title from the detail view (may be more complete)
    let title: string | undefined
    try {
      const titleEl = await page.$('h1.jobsearch-JobInfoHeader-title, h2.jobTitle')
      if (titleEl) {
        title = ((await titleEl.innerText()) ?? '').trim() || undefined
      }
    } catch {
      /* ignore */
    }

    return { description, salary, title }
  }

  /**
   * Fallback: find the largest text block on the page when known selectors fail.
   */
  private async fallbackExtractDescription(page: Page): Promise<string> {
    try {
      const text = await page.evaluate(() => {
        let best = ''
        const candidates = document.querySelectorAll('div, section, article')
        for (const el of candidates) {
          const t = (el.textContent ?? '').trim()
          if (t.length > best.length && t.length > 100) {
            const childBlocks = el.querySelectorAll('div, section, article')
            if (childBlocks.length < 5) {
              best = t
            }
          }
        }
        return best
      })
      if (text) {
        log.info(`Fallback extracted description (${text.length} chars)`)
      }
      return text
    } catch (err) {
      log.warn('Fallback description extraction failed', err)
      return ''
    }
  }

  private async extractJobKeyFromLink(el: Awaited<ReturnType<Page['$']>>): Promise<string | null> {
    if (!el) return null
    try {
      const links = await el.$$('a')
      for (const link of links) {
        const href = await link.getAttribute('href')
        if (href) {
          const jkMatch = href.match(/[?&]jk=([a-f0-9]+)/i)
          if (jkMatch) return jkMatch[1]

          const vjMatch = href.match(/\/viewjob\?.*jk=([a-f0-9]+)/i)
          if (vjMatch) return vjMatch[1]
        }
      }
    } catch {
      /* ignore */
    }
    return null
  }
}
