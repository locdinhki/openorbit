import { getDatabase } from './database'
import type { JobListing } from '../types'
import { JobsRepo } from './jobs-repo'

export class ApplicationsRepo {
  private jobsRepo = new JobsRepo()

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
    const db = getDatabase()
    const row = db
      .prepare(
        `SELECT COUNT(*) as count FROM jobs
         WHERE status = 'applied' AND applied_at >= date('now')`
      )
      .get() as { count: number }
    return row.count
  }

  countAppliedInSession(sessionStartTime: string): number {
    const db = getDatabase()
    const row = db
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
