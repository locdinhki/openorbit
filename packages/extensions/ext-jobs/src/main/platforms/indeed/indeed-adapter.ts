import type { Page } from 'patchright'
import type {
  SearchProfile,
  JobListing,
  SiteHintFile,
  ApplicationResult
} from '@openorbit/core/types'
import type { PlatformAdapter } from '../platform-adapter'
import type { ProgressCallback, QuestionCallback } from '../linkedin/linkedin-applicator'
import { IndeedExtractor } from './indeed-extractor'
import { HumanBehavior } from '@openorbit/core/automation/human-behavior'
import { SkillsLoader } from '@openorbit/core/automation/skills-loader'
import { createLogger } from '@openorbit/core/utils/logger'
import { join } from 'path'

const log = createLogger('IndeedAdapter')

const DATE_POSTED_MAP: Record<string, string> = {
  past24hrs: '1',
  pastWeek: '7',
  pastMonth: '30'
}

const JOB_TYPE_MAP: Record<string, string> = {
  'full-time': 'fulltime',
  contract: 'contract',
  freelance: 'temporary',
  'part-time': 'parttime',
  internship: 'internship'
}

const PAGINATION_SELECTORS = [
  'a[data-testid="pagination-page-next"]',
  '.np[aria-label="Next Page"]',
  'nav[aria-label="pagination"] a:last-child'
]

export class IndeedAdapter implements PlatformAdapter {
  readonly platform = 'indeed' as const
  readonly baseUrl = 'https://www.indeed.com'

  private extractor = new IndeedExtractor()
  private behavior = new HumanBehavior()
  private skillsLoader: SkillsLoader

  constructor() {
    const hintsDir = join(__dirname, 'hints')
    this.skillsLoader = new SkillsLoader([hintsDir])
  }

  async isAuthenticated(_page: Page): Promise<boolean> {
    // Indeed doesn't require authentication for job search/viewing
    return true
  }

  async navigateToLogin(page: Page): Promise<void> {
    await page.goto('https://secure.indeed.com/auth', { waitUntil: 'domcontentloaded' })
  }

  buildSearchUrl(profile: SearchProfile, pageNum?: number): string {
    const params = new URLSearchParams()

    if (profile.search.keywords.length > 0 || profile.search.excludeTerms.length > 0) {
      const parts = [...profile.search.keywords]
      for (const term of profile.search.excludeTerms) {
        parts.push(`-${term}`)
      }
      params.set('q', parts.join(' '))
    }

    if (profile.search.location.length > 0) {
      params.set('l', profile.search.location[0])
    }

    if (profile.search.datePosted) {
      const val = DATE_POSTED_MAP[profile.search.datePosted]
      if (val) params.set('fromage', val)
    }

    if (profile.search.jobType.length > 0) {
      const types = profile.search.jobType.map((t) => JOB_TYPE_MAP[t]).filter(Boolean)
      if (types.length > 0) params.set('jt', types[0])
    }

    if (profile.search.remoteOnly) {
      params.set('rbl', '-1')
      params.set('remotejob', '032b3046-06a3-4876-8dfd-474eb5e7ed11')
    }

    // Pagination offset (Indeed uses 10 results per page)
    if (pageNum && pageNum > 1) {
      params.set('start', String((pageNum - 1) * 10))
    }

    return `${this.baseUrl}/jobs?${params.toString()}`
  }

  async extractListings(page: Page): Promise<Partial<JobListing>[]> {
    const cards = await this.extractor.extractJobCards(page)
    return cards.map((card) => ({
      externalId: card.externalId,
      platform: 'indeed' as const,
      title: card.title,
      company: card.company,
      location: card.location,
      url: card.url,
      easyApply: false
    }))
  }

  async hasNextPage(page: Page): Promise<boolean> {
    for (const sel of PAGINATION_SELECTORS) {
      try {
        const el = page.locator(sel).first()
        const visible = await el.isVisible({ timeout: 2000 })
        if (visible) return true
      } catch {
        /* try next */
      }
    }
    return false
  }

  async goToNextPage(page: Page): Promise<void> {
    for (const sel of PAGINATION_SELECTORS) {
      try {
        const el = page.locator(sel).first()
        const visible = await el.isVisible({ timeout: 2000 })
        if (visible) {
          await this.behavior.humanClick(page, sel)
          await page.waitForLoadState('domcontentloaded')
          await this.behavior.delay(2000, 4000)
          return
        }
      } catch {
        /* try next */
      }
    }
    log.warn('Could not find next page button')
  }

  async extractJobDetails(page: Page, url: string): Promise<Partial<JobListing>> {
    if (!page.url().includes(url) && url) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await this.behavior.delay(1000, 2000)
    }

    const details = await this.extractor.extractJobDetails(page)

    return {
      description: details.description,
      salary: details.salary,
      postedDate: new Date().toISOString(),
      ...(details.title && { title: details.title })
    }
  }

  async applyToJob(
    _page: Page,
    job: JobListing,
    _answers: Record<string, string>,
    _resumePath: string,
    _onProgress?: ProgressCallback,
    _onQuestion?: QuestionCallback
  ): Promise<ApplicationResult> {
    // Indeed's apply flow varies by employer (Indeed-hosted, ATS redirect, employer site).
    // Too variable to automate reliably — flag for manual review.
    return {
      success: false,
      jobId: job.id,
      answersUsed: {},
      needsManualIntervention: true,
      interventionReason: 'Indeed external apply — manual review required',
      errorMessage: 'Indeed applications require manual submission'
    }
  }

  getHints(): SiteHintFile {
    const skill = this.skillsLoader.loadSkill('indeed')
    if (skill) return skill
    return {
      site: 'indeed.com/jobs',
      lastFullScan: '',
      lastVerified: '',
      actions: {},
      changeLog: []
    }
  }

  updateHints(_hints: Partial<SiteHintFile>): void {
    log.warn('Indeed hint updates not yet supported')
  }
}
