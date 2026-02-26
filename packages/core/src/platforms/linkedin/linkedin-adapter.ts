import type { Page } from 'patchright'
import type { SearchProfile, JobListing, SiteHintFile, ApplicationResult } from '../../types'
import type { PlatformAdapter } from '../platform-adapter'
import { LinkedInExtractor } from './linkedin-extractor'
import {
  LinkedInApplicator,
  type ProgressCallback,
  type QuestionCallback
} from './linkedin-applicator'
import { HumanBehavior } from '../../automation/human-behavior'
import { SkillsLoader } from '../../automation/skills-loader'
import { createLogger } from '../../utils/logger'
import { writeFileSync } from 'fs'
import { join } from 'path'

const log = createLogger('LinkedInAdapter')

// LinkedIn URL filter mappings
const DATE_POSTED_MAP: Record<string, string> = {
  past24hrs: 'r86400',
  pastWeek: 'r604800',
  pastMonth: 'r2592000'
}

const JOB_TYPE_MAP: Record<string, string> = {
  'full-time': 'F',
  contract: 'C',
  freelance: 'T', // LinkedIn calls this "Temporary"
  'part-time': 'P'
}

// LinkedIn salary filter buckets (f_SB2 param)
const SALARY_BUCKETS = [
  { min: 40000, code: '1' },
  { min: 60000, code: '2' },
  { min: 80000, code: '3' },
  { min: 100000, code: '4' },
  { min: 120000, code: '5' },
  { min: 140000, code: '6' },
  { min: 160000, code: '7' },
  { min: 180000, code: '8' },
  { min: 200000, code: '9' }
]

const EXPERIENCE_MAP: Record<string, string> = {
  internship: '1',
  entry: '2',
  associate: '3',
  'mid-senior': '4',
  director: '5',
  executive: '6'
}

const PAGINATION_SELECTORS = [
  '.artdeco-pagination__button--next',
  'button[aria-label="Next"]',
  '[class*="pagination"] button:last-child'
]

export class LinkedInAdapter implements PlatformAdapter {
  readonly platform = 'linkedin' as const
  readonly baseUrl = 'https://www.linkedin.com'

  private extractor = new LinkedInExtractor()
  private applicator = new LinkedInApplicator()
  private behavior = new HumanBehavior()
  private skillsLoader: SkillsLoader
  private hintsPath: string

  constructor() {
    const hintsDir = join(__dirname, 'hints')
    this.hintsPath = join(hintsDir, 'linkedin-jobs.json')
    this.skillsLoader = new SkillsLoader([hintsDir])
  }

  async isAuthenticated(page: Page): Promise<boolean> {
    const authSelectors = [
      '.global-nav__me-photo',
      'img.global-nav__me-photo',
      '.global-nav__primary-link-me-menu-trigger',
      '.feed-identity-module__actor-meta'
    ]

    for (const sel of authSelectors) {
      try {
        const visible = await page.locator(sel).first().isVisible({ timeout: 3000 })
        if (visible) return true
      } catch {
        /* try next */
      }
    }

    // Also check URL — if we're on linkedin.com/feed we're likely logged in
    const url = page.url()
    if (url.includes('/feed') || url.includes('/jobs') || url.includes('/in/')) {
      // Verify by checking for a sign-in button (absence means logged in)
      try {
        const signIn = await page
          .locator('a[data-tracking-control-name="guest_homepage-basic_nav-header-signin"]')
          .isVisible({ timeout: 2000 })
        return !signIn
      } catch {
        return true
      }
    }

    return false
  }

  async navigateToLogin(page: Page): Promise<void> {
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' })
  }

  buildSearchUrl(profile: SearchProfile, pageNum?: number): string {
    const params = new URLSearchParams()

    // Keywords + exclude terms (LinkedIn supports -term syntax)
    if (profile.search.keywords.length > 0 || profile.search.excludeTerms.length > 0) {
      const parts = [...profile.search.keywords]
      for (const term of profile.search.excludeTerms) {
        parts.push(`-${term}`)
      }
      params.set('keywords', parts.join(' '))
    }

    // Location
    if (profile.search.location.length > 0) {
      params.set('location', profile.search.location[0])
    }

    // Date posted
    if (profile.search.datePosted) {
      const val = DATE_POSTED_MAP[profile.search.datePosted]
      if (val) params.set('f_TPR', val)
    }

    // Job types
    if (profile.search.jobType.length > 0) {
      const types = profile.search.jobType.map((t) => JOB_TYPE_MAP[t]).filter(Boolean)
      if (types.length > 0) params.set('f_JT', types.join(','))
    }

    // Experience levels
    if (profile.search.experienceLevel.length > 0) {
      const levels = profile.search.experienceLevel
        .map((l) => EXPERIENCE_MAP[l.toLowerCase()])
        .filter(Boolean)
      if (levels.length > 0) params.set('f_E', levels.join(','))
    }

    // Remote only
    if (profile.search.remoteOnly) {
      params.set('f_WT', '2')
    }

    // Salary minimum — map to highest LinkedIn bucket <= salaryMin
    if (profile.search.salaryMin) {
      const bucket = [...SALARY_BUCKETS].reverse().find((b) => b.min <= profile.search.salaryMin!)
      if (bucket) params.set('f_SB2', bucket.code)
    }

    // Easy Apply only
    if (profile.search.easyApplyOnly) {
      params.set('f_AL', 'true')
    }

    // Pagination offset (LinkedIn uses 25 results per page)
    if (pageNum && pageNum > 1) {
      params.set('start', String((pageNum - 1) * 25))
    }

    return `${this.baseUrl}/jobs/search/?${params.toString()}`
  }

  async extractListings(page: Page): Promise<Partial<JobListing>[]> {
    // Scroll through the list to load lazy content
    await this.scrollJobList(page)

    const cards = await this.extractor.extractJobCards(page)
    const listings: Partial<JobListing>[] = []

    for (const card of cards) {
      listings.push({
        externalId: card.externalId,
        platform: 'linkedin',
        title: card.title,
        company: card.company,
        location: card.location,
        url: card.url,
        easyApply: card.easyApply
      })
    }

    return listings
  }

  async hasNextPage(page: Page): Promise<boolean> {
    for (const sel of PAGINATION_SELECTORS) {
      try {
        const el = page.locator(sel).first()
        const visible = await el.isVisible({ timeout: 2000 })
        if (visible) {
          const disabled = await el.getAttribute('disabled')
          return disabled === null
        }
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
    // Navigate if not already on the job page
    if (!page.url().includes(url) && url) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await this.behavior.delay(1000, 2000)
    }

    const details = await this.extractor.extractJobDetails(page)

    return {
      description: details.description,
      salary: details.salary,
      postedDate: details.postedDate || new Date().toISOString(),
      ...(details.title && { title: details.title }),
      ...(details.company && { company: details.company })
    }
  }

  async applyToJob(
    page: Page,
    job: JobListing,
    answers: Record<string, string>,
    resumePath: string,
    onProgress?: ProgressCallback,
    onQuestion?: QuestionCallback
  ): Promise<ApplicationResult> {
    return this.applicator.apply(page, job, answers, resumePath, onProgress, onQuestion)
  }

  getHints(): SiteHintFile {
    const skill = this.skillsLoader.loadSkill('linkedin')
    if (skill) return skill
    return {
      site: 'linkedin.com/jobs',
      lastFullScan: '',
      lastVerified: '',
      actions: {},
      changeLog: []
    }
  }

  updateHints(hints: Partial<SiteHintFile>): void {
    try {
      const current = this.getHints()
      const updated = { ...current, ...hints }
      writeFileSync(this.hintsPath, JSON.stringify(updated, null, 2))
    } catch (err) {
      log.error('Failed to update hints', err)
    }
  }

  /** Scroll the job list incrementally to trigger lazy loading */
  private async scrollJobList(page: Page): Promise<void> {
    const listSelectors = [
      '.jobs-search-results-list',
      '.scaffold-layout__list',
      '.jobs-search__results-list'
    ]

    for (const sel of listSelectors) {
      try {
        const visible = await page.locator(sel).first().isVisible({ timeout: 2000 })
        if (visible) {
          const metrics = await page.evaluate((listSel) => {
            const list = document.querySelector(listSel)
            if (!list) return { scrollHeight: 0, clientHeight: 0 }
            return { scrollHeight: list.scrollHeight, clientHeight: list.clientHeight }
          }, sel)

          if (metrics.scrollHeight <= metrics.clientHeight) return

          // Scroll in small increments to trigger lazy loading for all items
          const step = Math.max(200, Math.floor(metrics.clientHeight / 3))
          let pos = 0
          let scrollHeight = metrics.scrollHeight

          while (pos < scrollHeight) {
            pos = Math.min(pos + step, scrollHeight)
            await page.evaluate(
              (args: { sel: string; pos: number }) => {
                const list = document.querySelector(args.sel)
                if (list) list.scrollTop = args.pos
              },
              { sel, pos }
            )
            await this.behavior.delay(300, 600)

            // Check if scrollHeight grew (new content lazy-loaded)
            const newHeight = await page.evaluate((listSel) => {
              const list = document.querySelector(listSel)
              return list ? list.scrollHeight : 0
            }, sel)
            if (newHeight > scrollHeight) scrollHeight = newHeight
          }

          // Brief pause at bottom — do NOT scroll back to top
          // (scrolling back would cause LinkedIn to occlude bottom items)
          await this.behavior.delay(500, 1000)
          return
        }
      } catch {
        /* try next */
      }
    }
  }
}
