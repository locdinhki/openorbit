// ============================================================================
// OpenOrbit — iMessage Message Formatters
//
// Format OpenOrbit data for iMessage plain text.
// iMessage has no inline keyboards — approve/reject via text commands.
// ============================================================================

import type { JobListing, SearchProfile, ActionLog } from '@openorbit/core/types'
import type { JobsRepo } from '@openorbit/ext-jobs/main/db/jobs-repo'
import type { ActionLogRepo } from '@openorbit/ext-jobs/main/db/action-log-repo'

// ---------------------------------------------------------------------------
// Job formatters
// ---------------------------------------------------------------------------

export function formatJobList(jobs: JobListing[], title: string): string {
  if (jobs.length === 0) {
    return `${title}\n\nNo jobs found.`
  }

  const lines = [`${title} (${jobs.length})`, '']
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    const score = job.matchScore != null ? ` | Match: ${job.matchScore}%` : ''
    const location = job.location ? ` | ${job.location}` : ''
    const salary = job.salary ? ` | ${job.salary}` : ''
    lines.push(`${i + 1}. ${job.title}`)
    lines.push(`   ${job.company}${location}${salary}${score}`)
    lines.push('')
  }

  lines.push("Reply 'approve N' or 'reject N' to act on a job.")

  return truncate(lines.join('\n'))
}

export function formatJobDetail(job: JobListing): string {
  const lines = [
    job.title,
    `Company: ${job.company}`,
    `Platform: ${job.platform}`,
    `Location: ${job.location || 'N/A'}`,
    `Salary: ${job.salary || 'N/A'}`,
    `Type: ${job.jobType}`,
    `Status: ${job.status}`,
    `Match Score: ${job.matchScore != null ? `${job.matchScore}%` : 'N/A'}`,
    ''
  ]

  if (job.summary) {
    lines.push(`Summary: ${job.summary}`)
    lines.push('')
  }

  if (job.highlights) {
    lines.push(`Highlights: ${job.highlights}`)
    lines.push('')
  }

  if (job.redFlags) {
    lines.push(`Red Flags: ${job.redFlags}`)
    lines.push('')
  }

  lines.push(job.url)

  return truncate(lines.join('\n'))
}

// ---------------------------------------------------------------------------
// Profile formatters
// ---------------------------------------------------------------------------

export function formatProfileList(profiles: SearchProfile[]): string {
  if (profiles.length === 0) {
    return 'Search Profiles\n\nNo profiles configured.'
  }

  const lines = [`Search Profiles (${profiles.length})`, '']
  for (const p of profiles) {
    const icon = p.enabled ? '\u2705' : '\u274C'
    lines.push(`${icon} ${p.name} (${p.platform})`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Action log formatters
// ---------------------------------------------------------------------------

export function formatActionLog(entries: ActionLog[]): string {
  if (entries.length === 0) {
    return 'Action Log\n\nNo recent actions.'
  }

  const lines = [`Recent Actions (${entries.length})`, '']
  for (const entry of entries) {
    const icon = entry.success ? '\u2705' : '\u274C'
    const time = formatTime(entry.timestamp)
    lines.push(`${time} ${icon} ${entry.intent}`)
  }

  return truncate(lines.join('\n'))
}

// ---------------------------------------------------------------------------
// Status summary
// ---------------------------------------------------------------------------

export function formatStatusSummary(jobsRepo: JobsRepo, actionLogRepo: ActionLogRepo): string {
  try {
    const newJobs = jobsRepo.list({ status: 'new' as any })
    const approvedJobs = jobsRepo.list({ status: 'approved' as any })
    const appliedJobs = jobsRepo.list({ status: 'applied' as any })
    const recentActions = actionLogRepo.getRecent(1)

    const lines = [
      'Status Summary',
      '',
      `New jobs: ${newJobs.length}`,
      `Approved: ${approvedJobs.length}`,
      `Applied: ${appliedJobs.length}`
    ]

    if (recentActions.length > 0) {
      lines.push(`Last activity: ${formatTime(recentActions[0].timestamp)}`)
    }

    return lines.join('\n')
  } catch {
    return 'Status Summary\n\nUnable to retrieve status.'
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return timestamp
  }
}

function truncate(text: string): string {
  if (text.length <= 4000) return text
  return text.slice(0, 3980) + '\n\n(truncated)'
}
