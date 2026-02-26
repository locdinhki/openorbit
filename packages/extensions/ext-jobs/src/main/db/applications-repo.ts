import type Database from 'better-sqlite3'
import type { JobListing } from '@openorbit/core/types'
import { JobsRepo } from './jobs-repo'

export class ApplicationsRepo {
  private jobsRepo: JobsRepo

  constructor(private db: Database.Database) {
    this.jobsRepo = new JobsRepo(db)
  }

  listApplied(filters?: { platform?: string; limit?: number; offset?: number }): JobListing[] {
    return this.jobsRepo.list({
      status: 'applied',
      platform: filters?.platform,
      limit: filters?.limit,
      offset: filters?.offset
    })
  }

  listApproved(): JobListing[] {
    return this.jobsRepo.list({ status: 'approved' })
  }

  countAppliedToday(): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM jobs
         WHERE status = 'applied' AND applied_at >= date('now')`
      )
      .get() as { count: number }
    return row.count
  }

  countAppliedInSession(sessionStartTime: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM jobs
         WHERE status = 'applied' AND applied_at >= ?`
      )
      .get(sessionStartTime) as { count: number }
    return row.count
  }

  markApplied(
    jobId: string,
    details: {
      applicationAnswers?: Record<string, string>
      coverLetterUsed?: string
      resumeUsed?: string
    }
  ): void {
    this.jobsRepo.updateStatus(jobId, 'applied')
    this.jobsRepo.updateApplicationDetails(jobId, details)
  }
}
