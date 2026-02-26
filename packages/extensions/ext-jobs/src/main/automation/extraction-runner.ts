import type { Page } from 'patchright'
import type Database from 'better-sqlite3'
import type { SearchProfile, JobListing, AutomationStatus } from '@openorbit/core/types'
import { AutomationError, AuthenticationError, PlatformError } from '@openorbit/core/errors'
import { LinkedInAdapter } from '../platforms/linkedin/linkedin-adapter'
import { IndeedAdapter } from '../platforms/indeed/indeed-adapter'
import { UpworkAdapter } from '../platforms/upwork/upwork-adapter'
import type { PlatformAdapter } from '../platforms/platform-adapter'
import { HumanBehavior } from '@openorbit/core/automation/human-behavior'
import { SessionManager } from '@openorbit/core/automation/session-manager'
import { RateLimiter } from '@openorbit/core/automation/rate-limiter'
import { CircuitBreaker, CircuitOpenError } from '@openorbit/core/automation/circuit-breaker'
import { getCoreEventBus } from '@openorbit/core/automation/core-events'
import type { CoreEventBus } from '@openorbit/core/automation/core-events'
import { JobsRepo } from '../db/jobs-repo'
import { ProfilesRepo } from '../db/profiles-repo'
import { ApplicationsRepo } from '../db/applications-repo'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { JobAnalyzer } from '@openorbit/core/ai/job-analyzer'
import { MAX_ACTIONS_PER_MINUTE, MAX_APPLICATIONS_PER_SESSION } from '@openorbit/core/constants'
import { getCoreNotifier } from '@openorbit/core/core-notifier'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('ExtractionRunner')

/**
 * Detect and fix duplicated title text from DOM extraction.
 * LinkedIn's title elements often have nested spans that cause
 * innerText() to return "Title Title" or "Title Title with suffix".
 */
export function deduplicateTitle(raw: string): string {
  const title = raw.trim()
  if (title.length < 10) return title

  const words = title.split(/\s+/)
  if (words.length < 4) return title

  // Check if the first N words repeat at position N (e.g., "A B C A B C ...")
  for (let n = Math.floor(words.length / 3); n <= Math.ceil(words.length / 2); n++) {
    const prefix = words.slice(0, n).join(' ')
    const rest = words.slice(n).join(' ')
    if (rest.startsWith(prefix)) {
      // Return the longer/more complete version
      return rest
    }
  }

  return title
}

export class ExtractionRunner {
  private events: CoreEventBus
  private sessionManager: SessionManager
  private dedicatedPage: Page | null = null
  private platformLabel: string | null = null
  private onStatusUpdate: ((status: AutomationStatus) => void) | null = null
  private jobsRepo: JobsRepo
  private profilesRepo: ProfilesRepo
  private applicationsRepo: ApplicationsRepo
  private behavior = new HumanBehavior()
  private rateLimiter = new RateLimiter(MAX_ACTIONS_PER_MINUTE)
  private circuitBreaker = new CircuitBreaker(3, 60_000)
  private running = false
  private paused = false
  private pendingQuestionResolve: ((answer: string | null) => void) | null = null

  private stats: AutomationStatus = {
    state: 'idle',
    jobsExtracted: 0,
    jobsAnalyzed: 0,
    applicationsSubmitted: 0,
    actionsPerMinute: 0,
    errors: []
  }

  constructor(
    db: Database.Database,
    sessionManager: SessionManager,
    opts?: {
      page?: Page
      platform?: string
      onStatusUpdate?: (status: AutomationStatus) => void
    }
  ) {
    this.events = getCoreEventBus()
    this.sessionManager = sessionManager
    this.jobsRepo = new JobsRepo(db)
    this.profilesRepo = new ProfilesRepo(db)
    this.applicationsRepo = new ApplicationsRepo(db)
    this.dedicatedPage = opts?.page ?? null
    this.platformLabel = opts?.platform ?? null
    this.onStatusUpdate = opts?.onStatusUpdate ?? null
  }

  /** Get the page for this runner — dedicated page if set, otherwise from session manager. */
  private async getRunnerPage(): Promise<Page> {
    if (this.dedicatedPage) return this.dedicatedPage
    return this.sessionManager.getPage()
  }

  /** Close the dedicated page when this runner is done. */
  async closeDedicatedPage(): Promise<void> {
    if (this.dedicatedPage) {
      try {
        await this.dedicatedPage.close()
      } catch {
        /* page may already be closed */
      }
      this.dedicatedPage = null
    }
  }

  getPlatform(): string | null {
    return this.platformLabel
  }

  /** Run extraction for a single profile */
  async runProfile(profileId: string): Promise<void> {
    const profile = this.profilesRepo.getById(profileId)
    if (!profile) {
      throw new AutomationError(`Profile not found: ${profileId}`, 'PROFILE_NOT_FOUND', {
        profileId
      })
    }

    this.running = true
    this.paused = false
    this.resetStats()
    this.updateStatus('running', `Starting extraction: ${profile.name}`)

    try {
      const adapter = this.getAdapter(profile.platform)
      const page = await this.getRunnerPage()

      // Check authentication — prompt login if needed
      let authed = await adapter.isAuthenticated(page)
      if (!authed) {
        authed = await this.waitForLogin(page, adapter, profile.platform)
        if (!authed) {
          const authErr = new AuthenticationError(
            `Not authenticated on ${profile.platform}. Please log in first.`,
            profile.platform
          )
          this.updateStatus('error', authErr.message)
          this.stats.errors.push(authErr.message)
          this.sendStatus()
          return
        }
      }

      await this.extractFromProfile(page, profile, adapter)
    } catch (err) {
      log.error('Extraction failed', err)
      this.stats.errors.push(String(err))
      this.updateStatus('error', String(err))
    } finally {
      this.running = false
      if (this.stats.state !== 'error') {
        this.updateStatus('idle', undefined)
      }
      getCoreNotifier()?.notifySessionComplete(this.stats)
      this.sendStatus()
    }
  }

  /** Run extraction for all enabled profiles */
  async runAllEnabled(): Promise<void> {
    let profiles = this.profilesRepo.listEnabled()
    if (this.platformLabel) {
      profiles = profiles.filter((p) => p.platform === this.platformLabel)
    }
    if (profiles.length === 0) {
      log.info('No enabled profiles to run')
      return
    }

    this.running = true
    this.paused = false
    this.resetStats()
    this.updateStatus('running', 'Running all enabled profiles')

    try {
      const page = await this.getRunnerPage()

      for (const profile of profiles) {
        if (!this.running || this.paused) break

        this.updateStatus('running', `Extracting: ${profile.name}`)

        const adapter = this.getAdapter(profile.platform)
        let authed = await adapter.isAuthenticated(page)
        if (!authed) {
          authed = await this.waitForLogin(page, adapter, profile.platform)
          if (!authed) {
            log.warn(`Login timeout for ${profile.platform}, skipping ${profile.name}`)
            this.stats.errors.push(`Skipped ${profile.name}: not logged in to ${profile.platform}`)
            continue
          }
        }

        await this.extractFromProfile(page, profile, adapter)

        // Pause between profiles
        if (this.running && profiles.indexOf(profile) < profiles.length - 1) {
          await this.behavior.betweenApplications()
        }
      }
    } catch (err) {
      log.error('Run all failed', err)
      this.stats.errors.push(String(err))
      this.updateStatus('error', String(err))
    } finally {
      this.running = false
      if (this.stats.state !== 'error') {
        this.updateStatus('idle', undefined)
      }
      getCoreNotifier()?.notifySessionComplete(this.stats)
      this.sendStatus()
    }
  }

  /** Navigate to login and poll until user authenticates (or extraction is stopped) */
  private async waitForLogin(
    page: Page,
    adapter: PlatformAdapter,
    platform: string
  ): Promise<boolean> {
    log.info(`Not authenticated on ${platform}, navigating to login page`)
    this.updateStatus('running', `Waiting for ${platform} login...`)
    this.sendStatus()

    await adapter.navigateToLogin(page)

    // Poll every 3s for up to 5 minutes
    const maxWait = 5 * 60_000
    const interval = 3_000
    const deadline = Date.now() + maxWait

    while (Date.now() < deadline && this.running) {
      await new Promise((r) => setTimeout(r, interval))
      if (!this.running) return false

      const authed = await adapter.isAuthenticated(page)
      if (authed) {
        log.info(`User logged in to ${platform}`)
        return true
      }
    }

    log.warn(`Login timeout for ${platform}`)
    return false
  }

  /** Stop the current extraction */
  stop(): void {
    log.info('Stopping extraction')
    this.running = false
    this.paused = false
    this.updateStatus('idle', undefined)
  }

  /** Pause the current extraction */
  pause(): void {
    log.info('Pausing extraction')
    this.paused = true
    this.updateStatus('paused', 'Paused by user')
  }

  /** Resume a paused extraction */
  resume(): void {
    log.info('Resuming extraction')
    this.paused = false
    this.updateStatus('running', 'Resumed')
  }

  getStatus(): AutomationStatus {
    return { ...this.stats }
  }

  isRunning(): boolean {
    return this.running
  }

  /** Core extraction loop for a single profile */
  private async extractFromProfile(
    page: Page,
    profile: SearchProfile,
    adapter: PlatformAdapter
  ): Promise<void> {
    const searchUrl = adapter.buildSearchUrl(profile)
    log.info(`Navigating to search: ${searchUrl}`)
    log.info(`Search keywords: [${profile.search.keywords.join(', ')}], location: [${profile.search.location.join(', ')}]`)

    this.updateStatus('running', `Searching: ${profile.search.keywords.join(', ')}`)
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' })
    await this.behavior.delay(2000, 4000)

    let pageNum = 1
    const maxPages = 5

    while (this.running && !this.paused && pageNum <= maxPages) {
      // Rate limit check
      if (this.stats.jobsExtracted >= HumanBehavior.MAX_EXTRACTIONS_PER_SESSION) {
        log.info('Extraction limit reached for session')
        break
      }

      this.updateStatus('running', `Page ${pageNum}: extracting listings`)

      // Extract job cards from current page
      const listings = await adapter.extractListings(page)
      log.info(`Found ${listings.length} listings on page ${pageNum}`)

      if (listings.length === 0) {
        log.info('No listings found, stopping pagination')
        break
      }

      // Process each listing via adapter
      for (let i = 0; i < listings.length; i++) {
        if (!this.running || this.paused) break

        const listing = listings[i]
        if (!listing.externalId) continue

        // Duplicate detection
        if (this.jobsRepo.exists(listing.externalId, profile.platform)) {
          log.info(`Skipping duplicate: ${listing.title} (${listing.externalId})`)
          continue
        }

        this.updateStatus('running', `Extracting: ${listing.title}`)

        // Rate limit before each action
        await this.rateLimiter.acquire()

        // Extract full details via adapter with circuit breaker protection
        try {
          const details = await this.circuitBreaker.execute(async () => {
            await this.behavior.delay(1500, 3000)
            return adapter.extractJobDetails(page, listing.url || '')
          })

          // Build full job listing
          const jobData: Omit<JobListing, 'id' | 'createdAt' | 'updatedAt'> = {
            externalId: listing.externalId,
            platform: profile.platform,
            profileId: profile.id,
            url: listing.url || page.url(),
            title: deduplicateTitle(details.title || listing.title || ''),
            company: details.company || listing.company || '',
            location: listing.location || '',
            salary: details.salary,
            jobType: profile.search.jobType[0] || 'full-time',
            description: details.description || '',
            postedDate: details.postedDate || new Date().toISOString(),
            easyApply: listing.easyApply ?? false,
            status: 'new'
          }

          // Save to DB
          const saved = this.jobsRepo.insert(jobData)
          this.stats.jobsExtracted++
          log.info(`Saved job: ${saved.title} @ ${saved.company}`)

          // Push to UI
          this.sendNewJob(saved)
          this.sendStatus()

          // Human behavior delay between listings
          await this.behavior.betweenListings()
          await this.behavior.occasionalIdle()
        } catch (err) {
          // Circuit breaker open — stop extraction entirely
          if (err instanceof CircuitOpenError) {
            log.warn('Circuit breaker open — pausing extraction')
            this.stats.errors.push('Too many consecutive failures — extraction paused')
            this.updateStatus('error', 'Too many failures — extraction paused')
            getCoreNotifier()?.notifyCircuitBreakerTripped()
            break
          }

          log.warn(`Failed to extract details for: ${listing.title}`, err)
          // Still save with basic info from the card
          try {
            const basicJob: Omit<JobListing, 'id' | 'createdAt' | 'updatedAt'> = {
              externalId: listing.externalId,
              platform: profile.platform,
              profileId: profile.id,
              url: listing.url || '',
              title: deduplicateTitle(listing.title || ''),
              company: listing.company || '',
              location: listing.location || '',
              jobType: profile.search.jobType[0] || 'full-time',
              description: '',
              postedDate: new Date().toISOString(),
              easyApply: listing.easyApply ?? false,
              status: 'new'
            }
            const saved = this.jobsRepo.insert(basicJob)
            this.stats.jobsExtracted++
            this.sendNewJob(saved)
            this.sendStatus()
          } catch (insertErr) {
            log.error('Failed to save basic job', insertErr)
          }
        }
      }

      // Navigate directly to the next page URL
      // (avoids stale-URL issues with goToNextPage after extractJobDetails navigates away)
      pageNum++
      if (pageNum > maxPages) break

      const nextPageUrl = adapter.buildSearchUrl(profile, pageNum)
      log.info(`Navigating to page ${pageNum}: ${nextPageUrl}`)
      await page.goto(nextPageUrl, { waitUntil: 'domcontentloaded' })
      await this.behavior.delay(2000, 4000)
    }

    log.info(`Extraction complete for ${profile.name}: ${this.stats.jobsExtracted} jobs`)

    // Auto-analyze newly extracted jobs with Claude
    await this.autoAnalyzeNewJobs(profile.id)
  }

  /** Auto-analyze newly extracted jobs using Claude */
  private async autoAnalyzeNewJobs(profileId: string): Promise<void> {
    const newJobs = this.jobsRepo.list({ status: 'new', profileId })
    if (newJobs.length === 0) return

    this.updateStatus('running', `Analyzing ${newJobs.length} jobs with Claude`)
    log.info(`Auto-analyzing ${newJobs.length} new jobs`)

    const analyzer = new JobAnalyzer()
    let analyzed = 0

    for (const job of newJobs) {
      if (!this.running) break

      try {
        this.updateStatus('running', `Analyzing: ${job.title}`)
        const analysis = await analyzer.analyze(job)

        this.jobsRepo.updateAnalysis(job.id, {
          matchScore: analysis.matchScore,
          matchReasoning: analysis.reasoning,
          summary: analysis.summary,
          redFlags: analysis.redFlags,
          highlights: analysis.highlights
        })
        this.jobsRepo.updateStatus(job.id, 'reviewed')

        analyzed++
        this.stats.jobsAnalyzed = analyzed

        // Notify on high-match jobs (score >= 0.8)
        if (analysis.matchScore >= 0.8) {
          getCoreNotifier()?.notifyHighMatchJob({
            title: job.title,
            company: job.company,
            matchScore: analysis.matchScore
          })
        }

        // Push updated job to UI
        const updated = this.jobsRepo.getById(job.id)
        if (updated) {
          this.sendNewJob(updated)
        }
        this.sendStatus()
      } catch (err) {
        log.warn(`Failed to analyze job: ${job.title}`, err)
        // Continue with next job — analysis failure is non-fatal
      }
    }

    log.info(`Analysis complete: ${analyzed}/${newJobs.length} jobs analyzed`)
  }

  /** Re-fetch descriptions for jobs that have empty descriptions */
  async refetchDescriptions(): Promise<{ updated: number; total: number }> {
    let jobs = this.jobsRepo.listMissingDescription()
    if (this.platformLabel) {
      jobs = jobs.filter((j) => j.platform === this.platformLabel)
    }
    if (jobs.length === 0) {
      log.info('No jobs with missing descriptions')
      return { updated: 0, total: 0 }
    }

    log.info(`Re-fetching descriptions for ${jobs.length} jobs`)
    const page = await this.getRunnerPage()
    let updated = 0

    // Reuse one adapter per platform so the SelectorHealer's
    // attemptedThisSession set and in-memory cache carry over
    // between jobs — avoids redundant Claude API calls.
    const adapters = new Map<string, PlatformAdapter>()
    const getOrCreateAdapter = (platform: string): PlatformAdapter => {
      let adapter = adapters.get(platform)
      if (!adapter) {
        adapter = this.getAdapter(platform)
        adapters.set(platform, adapter)
      }
      return adapter
    }

    // Emit progress so the UI knows we're working
    this.updateStatus('running', `Re-fetching descriptions: 0/${jobs.length}`)

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      this.updateStatus('running', `Re-fetching descriptions: ${i + 1}/${jobs.length} — ${job.title}`)

      try {
        const adapter = getOrCreateAdapter(job.platform)
        await page.goto(job.url, { waitUntil: 'domcontentloaded' })
        await this.behavior.delay(1500, 3000)

        const details = await adapter.extractJobDetails(page, job.url)
        if (details.description) {
          this.jobsRepo.updateDescription(job.id, details.description)

          // Also fix duplicated titles while we're at it
          if (details.title) {
            const cleanTitle = deduplicateTitle(details.title)
            if (cleanTitle !== job.title) {
              this.jobsRepo.updateTitle(job.id, cleanTitle)
            }
          }

          updated++
          log.info(`Updated description for: ${job.title} (${details.description.length} chars)`)

          // Push updated job to UI
          const refreshed = this.jobsRepo.getById(job.id)
          if (refreshed) this.sendNewJob(refreshed)
        }
      } catch (err) {
        log.warn(`Failed to re-fetch description for: ${job.title}`, err)
      }
    }

    // Restore idle status
    this.updateStatus('idle', undefined)
    log.info(`Re-fetch complete: ${updated}/${jobs.length} descriptions updated`)
    return { updated, total: jobs.length }
  }

  /** Apply to all approved jobs */
  async applyToApproved(): Promise<void> {
    if (new SettingsRepo().get('apply_disabled') === '1') {
      log.info('Auto-apply is disabled — skipping application batch')
      return
    }

    let approvedJobs = this.applicationsRepo.listApproved()
    if (this.platformLabel) {
      approvedJobs = approvedJobs.filter((j) => j.platform === this.platformLabel)
    }
    if (approvedJobs.length === 0) {
      log.info('No approved jobs to apply to')
      return
    }

    this.running = true
    this.paused = false
    this.resetStats()
    this.updateStatus('running', `Applying to ${approvedJobs.length} jobs`)

    try {
      const page = await this.getRunnerPage()

      let applied = 0

      for (const job of approvedJobs) {
        if (!this.running || this.paused) break
        if (applied >= MAX_APPLICATIONS_PER_SESSION) {
          log.info('Session application limit reached')
          break
        }

        // Skip non-Easy Apply jobs (except platforms like Indeed/Upwork that handle apply differently)
        if (!job.easyApply && job.platform === 'linkedin') {
          log.info(`Skipping non-Easy Apply job: ${job.title}`)
          continue
        }

        const adapter = this.getAdapter(job.platform)

        // Check authentication per-platform
        let authed = await adapter.isAuthenticated(page)
        if (!authed) {
          authed = await this.waitForLogin(page, adapter, job.platform)
          if (!authed) {
            log.warn(`Login timeout for ${job.platform}, skipping ${job.title}`)
            this.stats.errors.push(`Skipped ${job.title}: not logged in to ${job.platform}`)
            continue
          }
        }

        this.updateStatus('running', `Applying: ${job.title} @ ${job.company}`)

        // Navigate to the job page
        await page.goto(job.url, { waitUntil: 'domcontentloaded' })
        await this.behavior.delay(1500, 3000)

        // Rate limit
        await this.rateLimiter.acquire()

        // Get profile for default answers and resume
        const profile = job.profileId ? this.profilesRepo.getById(job.profileId) : null
        const answers = profile?.application.defaultAnswers || {}
        const resumePath = profile?.application.resumeFile || ''

        try {
          const result = await this.circuitBreaker.execute(() =>
            adapter.applyToJob(
              page,
              job,
              answers,
              resumePath,
              (progress) => {
                this.sendApplicationProgress(job.id, progress.currentAction, progress.step)
              },
              (question, jobId) => this.waitForUserAnswer(question, jobId)
            )
          )

          if (result.success) {
            this.applicationsRepo.markApplied(job.id, {
              applicationAnswers: result.answersUsed,
              resumeUsed: result.resumeUsed
            })
            applied++
            this.stats.applicationsSubmitted = applied
            log.info(`Applied to ${job.title} @ ${job.company}`)
            getCoreNotifier()?.notifyApplicationComplete(job)
          } else {
            log.warn(`Failed to apply to ${job.title}: ${result.errorMessage}`)
            if (result.needsManualIntervention) {
              this.jobsRepo.updateStatus(job.id, 'error')
              this.stats.errors.push(`${job.title}: ${result.interventionReason}`)
            }
            getCoreNotifier()?.notifyApplicationFailed(job, result.errorMessage || 'Unknown error')
          }

          this.sendStatus()
          this.sendApplicationComplete(job.id, result.success, result.errorMessage)
        } catch (err) {
          if (err instanceof CircuitOpenError) {
            log.warn('Circuit breaker open — stopping applications')
            this.stats.errors.push('Too many consecutive failures — applications stopped')
            this.updateStatus('error', 'Too many failures — applications stopped')
            getCoreNotifier()?.notifyCircuitBreakerTripped()
            break
          }

          log.error(`Application error for ${job.title}`, err)
          this.jobsRepo.updateStatus(job.id, 'error')
          this.stats.errors.push(`${job.title}: ${String(err)}`)
        }

        // Delay between applications
        if (this.running && !this.paused) {
          await this.behavior.betweenApplications()
        }
      }

      log.info(`Application batch complete: ${applied}/${approvedJobs.length} applied`)
    } catch (err) {
      log.error('Apply batch failed', err)
      this.stats.errors.push(String(err))
      this.updateStatus('error', String(err))
    } finally {
      this.running = false
      if (this.stats.state !== 'error') {
        this.updateStatus('idle', undefined)
      }
      this.sendStatus()
    }
  }

  /** Called from IPC when user provides an answer to a paused question */
  resolveAnswer(answer: string | null): void {
    if (this.pendingQuestionResolve) {
      this.pendingQuestionResolve(answer)
      this.pendingQuestionResolve = null
    }
  }

  /** Wait for user to provide an answer via the UI */
  private waitForUserAnswer(question: string, jobId: string): Promise<string | null> {
    // Push the question to the renderer
    this.sendPauseQuestion(question, jobId)

    return new Promise<string | null>((resolve) => {
      this.pendingQuestionResolve = resolve

      // Timeout after 5 minutes — skip the question
      setTimeout(
        () => {
          if (this.pendingQuestionResolve === resolve) {
            this.pendingQuestionResolve = null
            resolve(null)
          }
        },
        5 * 60 * 1000
      )
    })
  }

  private sendApplicationProgress(jobId: string, action: string, step: number): void {
    this.events.emit('application:progress', { jobId, step, currentAction: action })
  }

  private sendPauseQuestion(question: string, jobId: string): void {
    this.events.emit('application:pause-question', { question, jobId })
  }

  private sendApplicationComplete(jobId: string, success: boolean, error?: string): void {
    this.events.emit('application:complete', { jobId, success, error })
  }

  private getAdapter(platform: string): PlatformAdapter {
    switch (platform) {
      case 'linkedin':
        return new LinkedInAdapter()
      case 'indeed':
        return new IndeedAdapter()
      case 'upwork':
        return new UpworkAdapter()
      default:
        throw new PlatformError(`Unsupported platform: ${platform}`, platform)
    }
  }

  private resetStats(): void {
    this.stats = {
      state: 'idle',
      jobsExtracted: 0,
      jobsAnalyzed: 0,
      applicationsSubmitted: 0,
      actionsPerMinute: 0,
      sessionStartTime: new Date().toISOString(),
      errors: []
    }
  }

  private updateStatus(state: AutomationStatus['state'], action: string | undefined): void {
    this.stats.state = state
    this.stats.currentAction = action
    this.sendStatus()
  }

  private sendStatus(): void {
    if (this.onStatusUpdate) {
      this.onStatusUpdate({ ...this.stats })
    } else {
      this.events.emit('automation:status', { ...this.stats })
    }
  }

  private sendNewJob(job: JobListing): void {
    this.events.emit('jobs:new', job)
  }
}
