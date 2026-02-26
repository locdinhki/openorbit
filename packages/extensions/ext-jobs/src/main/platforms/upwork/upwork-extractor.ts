import type { Page } from 'patchright'
import type { UpworkProjectDetails } from '@openorbit/core/types'
import { PageReader } from '@openorbit/core/automation/page-reader'
import { SelectorHealer } from '@openorbit/core/automation/selector-healer'
import { HumanBehavior } from '@openorbit/core/automation/human-behavior'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('UpworkExtractor')

const SELECTORS = {
  jobTiles: [
    '[data-test="job-tile-list"] article',
    '.job-tile',
    'section[data-test="JobTile"]',
    'article.air3-card-section'
  ],
  tileTitle: [
    '[data-test="job-tile-title-link"] h2',
    '.job-tile-title a',
    'h2.my-0 a',
    'a.up-n-link'
  ],
  tileClient: [
    '[data-test="client-info"]',
    '.client-info',
    '.up-n-link.text-muted',
    'small.text-muted'
  ],
  detailDescription: [
    '[data-test="job-description-text"]',
    '.job-description',
    '.up-line-clamp-v2',
    'div.break.mb-0'
  ],
  detailBudget: [
    '[data-test="budget"]',
    '[data-test="is-fixed-price"]',
    '.up-monetary',
    'strong.text-body-sm'
  ],
  detailSkills: ['[data-test="token"]', '.up-skill-badge', '.air3-token', 'span.badge']
}

export interface UpworkExtractedCard {
  externalId: string
  title: string
  clientName: string
  url: string
  snippet: string
}

export class UpworkExtractor {
  private reader = new PageReader()
  private behavior = new HumanBehavior()
  private healer = new SelectorHealer('upwork')

  constructor() {
    this.reader.setHealer(this.healer)
  }

  /** Extract all job tiles from Upwork search results */
  async extractJobCards(page: Page): Promise<UpworkExtractedCard[]> {
    const cards: UpworkExtractedCard[] = []

    let tileElements: Awaited<ReturnType<Page['$$']>> = []
    for (const sel of SELECTORS.jobTiles) {
      tileElements = await page.$$(sel)
      if (tileElements.length > 0) {
        log.info(`Found ${tileElements.length} job tiles using: ${sel}`)
        break
      }
    }

    if (tileElements.length === 0) {
      log.warn('No job tiles found on page')
      return cards
    }

    for (const el of tileElements) {
      try {
        // Extract job ID from link href
        const jobId = await this.extractJobIdFromTile(el)
        if (!jobId) continue

        // Title
        let title = ''
        for (const sel of SELECTORS.tileTitle) {
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

        // Client name
        let clientName = ''
        for (const sel of SELECTORS.tileClient) {
          try {
            const clientEl = await el.$(sel)
            if (clientEl) {
              clientName = ((await clientEl.innerText()) ?? '').trim()
              if (clientName) break
            }
          } catch {
            /* try next */
          }
        }

        // URL
        let url = ''
        try {
          const linkEl = await el.$('a[href*="/jobs/"]')
          if (linkEl) {
            const href = await linkEl.getAttribute('href')
            if (href) {
              url = href.startsWith('http') ? href : `https://www.upwork.com${href}`
            }
          }
        } catch {
          /* ignore */
        }
        if (!url) {
          url = `https://www.upwork.com/jobs/${jobId}`
        }

        // Description snippet
        let snippet = ''
        try {
          const descEl = await el.$('.up-line-clamp-v2, [data-test="UpCLineClamp JobDescription"]')
          if (descEl) {
            snippet = ((await descEl.innerText()) ?? '').trim()
          }
        } catch {
          /* ignore */
        }

        cards.push({ externalId: jobId, title, clientName, url, snippet })
      } catch (err) {
        log.warn('Failed to extract tile', err)
      }
    }

    log.info(`Extracted ${cards.length} tiles from ${tileElements.length} elements`)
    return cards
  }

  /** Extract full project details from an Upwork job page */
  async extractJobDetails(page: Page): Promise<{
    description: string
    budgetInfo?: string
    skills: string[]
    title?: string
    projectDetails?: UpworkProjectDetails
  }> {
    await this.behavior.delay(500, 1000)

    const description =
      (await this.reader.getTextBySelectors(page, SELECTORS.detailDescription)) ?? ''

    // Budget
    let budgetInfo: string | undefined
    for (const sel of SELECTORS.detailBudget) {
      try {
        const elements = await page.$$(sel)
        for (const el of elements) {
          const text = ((await el.innerText()) ?? '').trim()
          if (text && (text.includes('$') || text.includes('Budget') || text.includes('Hourly'))) {
            budgetInfo = text
            break
          }
        }
        if (budgetInfo) break
      } catch {
        /* try next */
      }
    }

    // Skills
    const skills: string[] = []
    for (const sel of SELECTORS.detailSkills) {
      try {
        const elements = await page.$$(sel)
        for (const el of elements) {
          const text = ((await el.innerText()) ?? '').trim()
          if (text && !skills.includes(text)) {
            skills.push(text)
          }
        }
        if (skills.length > 0) break
      } catch {
        /* try next */
      }
    }

    // Title
    let title: string | undefined
    try {
      const titleEl = await page.$('h1, h2[data-test="job-title"]')
      if (titleEl) {
        title = ((await titleEl.innerText()) ?? '').trim() || undefined
      }
    } catch {
      /* ignore */
    }

    // Parse budget into structured details
    const projectDetails = this.parseBudgetInfo(budgetInfo, skills)

    return { description, budgetInfo, skills, title, projectDetails }
  }

  private parseBudgetInfo(
    budgetInfo: string | undefined,
    skills: string[]
  ): UpworkProjectDetails | undefined {
    if (!budgetInfo) return undefined

    const details: UpworkProjectDetails = {
      budgetType: budgetInfo.toLowerCase().includes('hourly') ? 'hourly' : 'fixed',
      skillsRequired: skills
    }

    // Try to parse dollar amounts
    const amounts = budgetInfo.match(/\$[\d,]+(?:\.\d{2})?/g)
    if (amounts && amounts.length >= 2) {
      details.budgetMin = parseFloat(amounts[0].replace(/[$,]/g, ''))
      details.budgetMax = parseFloat(amounts[1].replace(/[$,]/g, ''))
    } else if (amounts && amounts.length === 1) {
      details.budgetFixed = parseFloat(amounts[0].replace(/[$,]/g, ''))
    }

    return details
  }

  private async extractJobIdFromTile(el: Awaited<ReturnType<Page['$']>>): Promise<string | null> {
    if (!el) return null
    try {
      const links = await el.$$('a')
      for (const link of links) {
        const href = await link.getAttribute('href')
        if (href) {
          // Upwork job URLs: /jobs/~XXXX or /ab/proposals/job/~XXXX
          const match = href.match(/~([0-9a-zA-Z]+)/)
          if (match) return match[1]
        }
      }
    } catch {
      /* ignore */
    }
    return null
  }
}
