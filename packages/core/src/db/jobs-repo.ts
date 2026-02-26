import { v4 as uuid } from 'uuid'
import { getDatabase } from './database'
import type { JobListing, JobStatus } from '../types'

interface JobRow {
  id: string
  external_id: string
  platform: string
  profile_id: string
  url: string
  title: string
  company: string
  location: string
  salary: string | null
  job_type: string
  description: string
  posted_date: string
  easy_apply: number
  match_score: number | null
  match_reasoning: string | null
  summary: string | null
  red_flags: string | null
  highlights: string | null
  status: string
  user_notes: string | null
  reviewed_at: string | null
  applied_at: string | null
  application_answers: string | null
  cover_letter_used: string | null
  resume_used: string | null
  created_at: string
  updated_at: string
}

function rowToJob(row: JobRow): JobListing {
  return {
    id: row.id,
    externalId: row.external_id,
    platform: row.platform,
    profileId: row.profile_id,
    url: row.url,
    title: row.title,
    company: row.company,
    location: row.location,
    salary: row.salary ?? undefined,
    jobType: row.job_type,
    description: row.description,
    postedDate: row.posted_date,
    easyApply: row.easy_apply === 1,
    matchScore: row.match_score ?? undefined,
    matchReasoning: row.match_reasoning ?? undefined,
    summary: row.summary ?? undefined,
    redFlags: row.red_flags ? JSON.parse(row.red_flags) : undefined,
    highlights: row.highlights ? JSON.parse(row.highlights) : undefined,
    status: row.status as JobStatus,
    userNotes: row.user_notes ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    appliedAt: row.applied_at ?? undefined,
    applicationAnswers: row.application_answers ? JSON.parse(row.application_answers) : undefined,
    coverLetterUsed: row.cover_letter_used ?? undefined,
    resumeUsed: row.resume_used ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class JobsRepo {
  insert(job: Omit<JobListing, 'id' | 'createdAt' | 'updatedAt'>): JobListing {
    const db = getDatabase()
    const id = uuid()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO jobs (
        id, external_id, platform, profile_id, url, title, company, location,
        salary, job_type, description, posted_date, easy_apply,
        match_score, match_reasoning, summary, red_flags, highlights,
        status, user_notes, reviewed_at, applied_at,
        application_answers, cover_letter_used, resume_used,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?
      )`
    ).run(
      id,
      job.externalId,
      job.platform,
      job.profileId,
      job.url,
      job.title,
      job.company,
      job.location,
      job.salary ?? null,
      job.jobType,
      job.description,
      job.postedDate,
      job.easyApply ? 1 : 0,
      job.matchScore ?? null,
      job.matchReasoning ?? null,
      job.summary ?? null,
      job.redFlags ? JSON.stringify(job.redFlags) : null,
      job.highlights ? JSON.stringify(job.highlights) : null,
      job.status,
      job.userNotes ?? null,
      job.reviewedAt ?? null,
      job.appliedAt ?? null,
      job.applicationAnswers ? JSON.stringify(job.applicationAnswers) : null,
      job.coverLetterUsed ?? null,
      job.resumeUsed ?? null,
      now,
      now
    )

    return this.getById(id)!
  }

  getById(id: string): JobListing | null {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined
    return row ? rowToJob(row) : null
  }

  getByExternalId(externalId: string, platform: string): JobListing | null {
    const db = getDatabase()
    const row = db
      .prepare('SELECT * FROM jobs WHERE external_id = ? AND platform = ?')
      .get(externalId, platform) as JobRow | undefined
    return row ? rowToJob(row) : null
  }

  list(filters?: {
    status?: JobStatus | JobStatus[]
    platform?: string
    profileId?: string
    minScore?: number
    limit?: number
    offset?: number
  }): JobListing[] {
    const db = getDatabase()
    const conditions: string[] = []
    const params: unknown[] = []

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(`status IN (${filters.status.map(() => '?').join(',')})`)
        params.push(...filters.status)
      } else {
        conditions.push('status = ?')
        params.push(filters.status)
      }
    }
    if (filters?.platform) {
      conditions.push('platform = ?')
      params.push(filters.platform)
    }
    if (filters?.profileId) {
      conditions.push('profile_id = ?')
      params.push(filters.profileId)
    }
    if (filters?.minScore !== undefined) {
      conditions.push('match_score >= ?')
      params.push(filters.minScore)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = filters?.limit ? `LIMIT ${filters.limit}` : ''
    const offset = filters?.offset ? `OFFSET ${filters.offset}` : ''

    const rows = db
      .prepare(`SELECT * FROM jobs ${where} ORDER BY created_at DESC ${limit} ${offset}`)
      .all(...params) as JobRow[]

    return rows.map(rowToJob)
  }

  updateStatus(id: string, status: JobStatus): void {
    const db = getDatabase()
    const now = new Date().toISOString()
    const extra: Record<string, string | null> = {}

    if (status === 'reviewed') extra.reviewed_at = now
    if (status === 'applied') extra.applied_at = now

    const sets = ['status = ?', 'updated_at = ?']
    const params: unknown[] = [status, now]

    for (const [key, value] of Object.entries(extra)) {
      sets.push(`${key} = ?`)
      params.push(value)
    }

    params.push(id)
    db.prepare(`UPDATE jobs SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  updateAnalysis(
    id: string,
    analysis: {
      matchScore: number
      matchReasoning: string
      summary: string
      redFlags: string[]
      highlights: string[]
    }
  ): void {
    const db = getDatabase()
    db.prepare(
      `UPDATE jobs SET
        match_score = ?, match_reasoning = ?, summary = ?,
        red_flags = ?, highlights = ?, updated_at = ?
      WHERE id = ?`
    ).run(
      analysis.matchScore,
      analysis.matchReasoning,
      analysis.summary,
      JSON.stringify(analysis.redFlags),
      JSON.stringify(analysis.highlights),
      new Date().toISOString(),
      id
    )
  }

  updateApplicationDetails(
    id: string,
    details: {
      applicationAnswers?: Record<string, string>
      coverLetterUsed?: string
      resumeUsed?: string
    }
  ): void {
    const db = getDatabase()
    db.prepare(
      `UPDATE jobs SET
        application_answers = ?, cover_letter_used = ?, resume_used = ?, updated_at = ?
      WHERE id = ?`
    ).run(
      details.applicationAnswers ? JSON.stringify(details.applicationAnswers) : null,
      details.coverLetterUsed ?? null,
      details.resumeUsed ?? null,
      new Date().toISOString(),
      id
    )
  }

  count(status?: JobStatus): number {
    const db = getDatabase()
    if (status) {
      const row = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE status = ?').get(status) as {
        count: number
      }
      return row.count
    }
    const row = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number }
    return row.count
  }

  listMissingDescription(): JobListing[] {
    const db = getDatabase()
    const rows = db
      .prepare(
        "SELECT * FROM jobs WHERE description = '' OR description IS NULL ORDER BY created_at DESC"
      )
      .all() as JobRow[]
    return rows.map(rowToJob)
  }

  updateDescription(id: string, description: string): void {
    const db = getDatabase()
    db.prepare('UPDATE jobs SET description = ?, updated_at = ? WHERE id = ?').run(
      description,
      new Date().toISOString(),
      id
    )
  }

  updateTitle(id: string, title: string): void {
    const db = getDatabase()
    db.prepare('UPDATE jobs SET title = ?, updated_at = ? WHERE id = ?').run(
      title,
      new Date().toISOString(),
      id
    )
  }

  delete(id: string): void {
    const db = getDatabase()
    db.prepare('DELETE FROM jobs WHERE id = ?').run(id)
  }

  exists(externalId: string, platform: string): boolean {
    const db = getDatabase()
    const row = db
      .prepare('SELECT 1 FROM jobs WHERE external_id = ? AND platform = ?')
      .get(externalId, platform)
    return !!row
  }
}
