import type { Page } from 'patchright'
import type {
  SearchProfile,
  JobListing,
  SiteHintFile,
  ApplicationResult
} from '@openorbit/core/types'
import type { PlatformAdapter } from '../platform-adapter'
import type { ProgressCallback, QuestionCallback } from '../linkedin/linkedin-applicator'
import { UpworkExtractor } from './upwork-extractor'
import { ProposalGenerator } from '@openorbit/core/ai/proposal-generator'
import { HumanBehavior } from '@openorbit/core/automation/human-behavior'
import { SkillsLoader } from '@openorbit/core/automation/skills-loader'
import { createLogger } from '@openorbit/core/utils/logger'
import { join } from 'path'

const log = createLogger('UpworkAdapter')

const SORT_MAP: Record<string, string> = {
  relevance: 'relevance',
  recency: 'recency'
}

const PAGINATION_SELECTORS = [
  'button[data-test="pagination-next"]',
  '.up-pagination-next',
  'nav[aria-label="Pagination"] button:last-child'
]

export class UpworkAdapter implements PlatformAdapter {
  readonly platform = 'upwork' as const
  readonly baseUrl = 'https://www.upwork.com'

  private extractor = new UpworkExtractor()
  private proposalGenerator = new ProposalGenerator()
  private behavior = new HumanBehavior()
  private skillsLoader: SkillsLoader

  constructor() {
    const hintsDir = join(__dirname, 'hints')
    this.skillsLoader = new SkillsLoader([hintsDir])
  }

  async isAuthenticated(page: Page): Promise<boolean> {
    // Check for Upwork nav elements indicating logged-in state
    const authSelectors = [
      '[data-test="nav-profile"]',
      '.nav-d-profile-image',
      '.up-avatar',
      'button[data-test="user-menu"]'
    ]

    for (const sel of authSelectors) {
      try {
        const visible = await page.locator(sel).first().isVisible({ timeout: 3000 })
        if (visible) return true
      } catch {
        /* try next */
      }
    }

    return false
  }

  async navigateToLogin(page: Page): Promise<void> {
    await page.goto('https://www.upwork.com/ab/account-security/login', {
      waitUntil: 'domcontentloaded'
    })
  }

  buildSearchUrl(profile: SearchProfile, pageNum?: number): string {
    const params = new URLSearchParams()

    if (profile.search.keywords.length > 0) {
      params.set('q', profile.search.keywords.join(' '))
    }

    // Upwork doesn't have location-based job search the same way
    // but supports remote by default

    // Sort by recency
    params.set('sort', SORT_MAP['recency'] || 'recency')

    // Pagination
    params.set('page', String(pageNum || 1))

    return `${this.baseUrl}/nx/search/jobs/?${params.toString()}`
  }

  async extractListings(page: Page): Promise<Partial<JobListing>[]> {
    const cards = await this.extractor.extractJobCards(page)
    return cards.map((card) => ({
      externalId: card.externalId,
      platform: 'upwork' as const,
      title: card.title,
      company: card.clientName,
      location: 'Remote', // Upwork is primarily remote
      url: card.url,
      easyApply: false, // Upwork uses proposals, not "Easy Apply"
      description: card.snippet
    }))
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
    if (!page.url().includes(url) && url) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      await this.behavior.delay(1000, 2000)
    }

    const details = await this.extractor.extractJobDetails(page)

    return {
      description: details.description,
      salary: details.budgetInfo,
      postedDate: new Date().toISOString(),
      ...(details.title && { title: details.title })
    }
  }

  async applyToJob(
    _page: Page,
    job: JobListing,
    _answers: Record<string, string>,
    _resumePath: string,
    onProgress?: ProgressCallback,
    _onQuestion?: QuestionCallback
  ): Promise<ApplicationResult> {
    // Generate a proposal via Claude
    onProgress?.({ currentAction: 'Generating proposal with Claude', step: 1, totalSteps: 2 })

    try {
      const proposal = await this.proposalGenerator.generateProposal(job)

      onProgress?.({
        currentAction: 'Proposal generated — manual submission required',
        step: 2,
        totalSteps: 2
      })

      // Upwork proposals must be submitted manually for safety
      // (connects cost real money, wrong proposals are costly)
      return {
        success: false,
        jobId: job.id,
        answersUsed: {},
        coverLetterUsed: proposal.coverLetter,
        needsManualIntervention: true,
        interventionReason: `Upwork proposal generated (confidence: ${(proposal.confidence * 100).toFixed(0)}%). Review and submit manually.${proposal.suggestedBid ? ` Suggested bid: $${proposal.suggestedBid}` : ''}`,
        errorMessage: 'Upwork proposals require manual submission'
      }
    } catch (err) {
      log.error('Proposal generation failed', err)
      return {
        success: false,
        jobId: job.id,
        answersUsed: {},
        needsManualIntervention: true,
        interventionReason: 'Failed to generate proposal — manual submission required',
        errorMessage: String(err)
      }
    }
  }

  getHints(): SiteHintFile {
    const skill = this.skillsLoader.loadSkill('upwork')
    if (skill) return skill
    return {
      site: 'upwork.com/jobs',
      lastFullScan: '',
      lastVerified: '',
      actions: {},
      changeLog: []
    }
  }

  updateHints(_hints: Partial<SiteHintFile>): void {
    log.warn('Upwork hint updates not yet supported')
  }
}
