import type { Page } from 'patchright'
import type { AutomationStatus, PlatformStatus } from '../types'
import { ExtractionRunner } from './extraction-runner'
import { SessionManager } from './session-manager'
import { ProfilesRepo } from '../db/profiles-repo'
import { ApplicationsRepo } from '../db/applications-repo'
import { getCoreEventBus } from './core-events'
import { createLogger } from '../utils/logger'

const log = createLogger('AutomationCoordinator')

/**
 * Orchestrates per-platform ExtractionRunners, each with its own
 * dedicated browser tab. Platforms run in parallel via Promise.allSettled.
 */
export class AutomationCoordinator {
  private runners = new Map<string, ExtractionRunner>()
  private platformPages = new Map<string, Page>()
  private sessionManager: SessionManager
  private profilesRepo = new ProfilesRepo()
  private applicationsRepo = new ApplicationsRepo()
  private sessionStartTime: string | null = null

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager
  }

  // ---------------------------------------------------------------------------
  // Extraction
  // ---------------------------------------------------------------------------

  /** Start extraction for all enabled profiles, grouped by platform in parallel. */
  async startAll(): Promise<void> {
    const profiles = this.profilesRepo.listEnabled()
    if (profiles.length === 0) {
      log.info('No enabled profiles to run')
      return
    }

    const byPlatform = new Map<string, string[]>()
    for (const p of profiles) {
      const ids = byPlatform.get(p.platform) ?? []
      ids.push(p.id)
      byPlatform.set(p.platform, ids)
    }

    this.sessionStartTime = new Date().toISOString()

    const promises: Promise<void>[] = []
    for (const [platform, profileIds] of byPlatform) {
      promises.push(this.startPlatform(platform, profileIds))
    }

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'rejected') {
        log.error('Platform run failed', result.reason)
      }
    }

    this.emitAggregateStatus()
  }

  /** Start extraction for a single profile on a dedicated page. */
  async startProfile(profileId: string): Promise<void> {
    const profile = this.profilesRepo.getById(profileId)
    if (!profile) throw new Error(`Profile not found: ${profileId}`)

    this.sessionStartTime = new Date().toISOString()
    await this.startPlatform(profile.platform, [profileId])
  }

  /** Start extraction for a specific platform with given profile IDs. */
  async startPlatform(platform: string, profileIds: string[]): Promise<void> {
    if (this.runners.has(platform) && this.runners.get(platform)!.isRunning()) {
      log.warn(`Platform ${platform} is already running`)
      return
    }

    const page = await this.sessionManager.newPage()
    this.platformPages.set(platform, page)

    const runner = new ExtractionRunner(this.sessionManager, {
      page,
      platform,
      onStatusUpdate: () => this.emitAggregateStatus()
    })
    this.runners.set(platform, runner)

    try {
      for (const id of profileIds) {
        if (!runner.isRunning() && profileIds.indexOf(id) > 0) break
        await runner.runProfile(id)
      }
    } finally {
      await this.cleanupPlatform(platform)
    }
  }

  // ---------------------------------------------------------------------------
  // Applications
  // ---------------------------------------------------------------------------

  /** Apply to all approved jobs, parallelized by platform. */
  async applyToApproved(): Promise<void> {
    const approvedJobs = this.applicationsRepo.listApproved()
    if (approvedJobs.length === 0) {
      log.info('No approved jobs to apply to')
      return
    }

    const platforms = new Set(approvedJobs.map((j) => j.platform))

    this.sessionStartTime = new Date().toISOString()
    const promises: Promise<void>[] = []

    for (const platform of platforms) {
      promises.push(this.applyForPlatform(platform))
    }

    await Promise.allSettled(promises)
    this.emitAggregateStatus()
  }

  private async applyForPlatform(platform: string): Promise<void> {
    const page = await this.sessionManager.newPage()
    this.platformPages.set(platform, page)

    const runner = new ExtractionRunner(this.sessionManager, {
      page,
      platform,
      onStatusUpdate: () => this.emitAggregateStatus()
    })
    this.runners.set(platform, runner)

    try {
      await runner.applyToApproved()
    } finally {
      await this.cleanupPlatform(platform)
    }
  }

  // ---------------------------------------------------------------------------
  // Re-fetch (single runner, not performance-critical)
  // ---------------------------------------------------------------------------

  async refetchDescriptions(): Promise<{ updated: number; total: number }> {
    const page = await this.sessionManager.newPage()
    const runner = new ExtractionRunner(this.sessionManager, { page })
    try {
      return await runner.refetchDescriptions()
    } finally {
      try {
        await page.close()
      } catch {
        /* */
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Control (stop / pause / resume)
  // ---------------------------------------------------------------------------

  stop(platform?: string): void {
    if (platform) {
      this.runners.get(platform)?.stop()
    } else {
      for (const runner of this.runners.values()) {
        runner.stop()
      }
    }
  }

  pause(platform?: string): void {
    if (platform) {
      this.runners.get(platform)?.pause()
    } else {
      for (const runner of this.runners.values()) {
        runner.pause()
      }
    }
  }

  resume(platform?: string): void {
    if (platform) {
      this.runners.get(platform)?.resume()
    } else {
      for (const runner of this.runners.values()) {
        runner.resume()
      }
    }
  }

  /** Route an answer to whichever runner has a pending question. */
  resolveAnswer(answer: string | null): void {
    for (const runner of this.runners.values()) {
      runner.resolveAnswer(answer)
    }
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  isRunning(): boolean {
    for (const runner of this.runners.values()) {
      if (runner.isRunning()) return true
    }
    return false
  }

  /** Aggregate status from all runners with per-platform breakdown. */
  getStatus(): AutomationStatus {
    const platforms: PlatformStatus[] = []
    let totalExtracted = 0
    let totalAnalyzed = 0
    let totalApplied = 0
    let totalAPM = 0
    const allErrors: string[] = []
    let aggregateState: AutomationStatus['state'] = 'idle'
    let mostRecentAction: string | undefined

    for (const [platform, runner] of this.runners) {
      const s = runner.getStatus()
      platforms.push({
        platform,
        state: s.state,
        currentAction: s.currentAction,
        jobsExtracted: s.jobsExtracted,
        jobsAnalyzed: s.jobsAnalyzed,
        applicationsSubmitted: s.applicationsSubmitted,
        errors: [...s.errors]
      })

      totalExtracted += s.jobsExtracted
      totalAnalyzed += s.jobsAnalyzed
      totalApplied += s.applicationsSubmitted
      totalAPM += s.actionsPerMinute
      allErrors.push(...s.errors)

      if (s.state === 'running') {
        aggregateState = 'running'
        mostRecentAction = s.currentAction
      } else if (s.state === 'paused' && aggregateState !== 'running') {
        aggregateState = 'paused'
      } else if (s.state === 'error' && aggregateState === 'idle') {
        aggregateState = 'error'
      }
    }

    return {
      state: aggregateState,
      currentAction: mostRecentAction,
      jobsExtracted: totalExtracted,
      jobsAnalyzed: totalAnalyzed,
      applicationsSubmitted: totalApplied,
      actionsPerMinute: totalAPM,
      sessionStartTime: this.sessionStartTime ?? undefined,
      errors: allErrors,
      platforms: platforms.length > 0 ? platforms : undefined
    }
  }

  /** Get the dedicated pages map (for screencast use). */
  getPages(): Map<string, Page> {
    return new Map(this.platformPages)
  }

  /** Get list of currently active platform names. */
  getActivePlatforms(): string[] {
    return Array.from(this.runners.keys()).filter((p) => this.runners.get(p)?.isRunning())
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  emitAggregateStatus(): void {
    const status = this.getStatus()
    getCoreEventBus().emit('automation:status', status)
  }

  private async cleanupPlatform(platform: string): Promise<void> {
    const runner = this.runners.get(platform)
    if (runner) {
      await runner.closeDedicatedPage()
      this.runners.delete(platform)
    }
    this.platformPages.delete(platform)
    log.info(`Cleaned up platform: ${platform}`)
  }
}
