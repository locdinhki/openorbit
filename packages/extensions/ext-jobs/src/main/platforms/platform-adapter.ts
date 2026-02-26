import type { SearchProfile, JobListing, SiteHintFile, ApplicationResult } from '@openorbit/core/types'
import type { Page } from 'patchright'
import type { ProgressCallback, QuestionCallback } from './linkedin/linkedin-applicator'

export interface PlatformAdapter {
  readonly platform: string
  readonly baseUrl: string

  isAuthenticated(page: Page): Promise<boolean>
  navigateToLogin(page: Page): Promise<void>
  buildSearchUrl(profile: SearchProfile, pageNum?: number): string
  extractListings(page: Page): Promise<Partial<JobListing>[]>
  hasNextPage(page: Page): Promise<boolean>
  goToNextPage(page: Page): Promise<void>
  extractJobDetails(page: Page, url: string): Promise<Partial<JobListing>>
  applyToJob(
    page: Page,
    job: JobListing,
    answers: Record<string, string>,
    resumePath: string,
    onProgress?: ProgressCallback,
    onQuestion?: QuestionCallback
  ): Promise<ApplicationResult>
  getHints(): SiteHintFile
  updateHints(hints: Partial<SiteHintFile>): void
}
