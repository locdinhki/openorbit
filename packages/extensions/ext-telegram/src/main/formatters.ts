// ============================================================================
// OpenOrbit — Telegram Message Formatters
//
// Format OpenOrbit data for Telegram's markdown message format.
// Telegram has a 4096-character message limit, so all formatters truncate.
// ============================================================================

import type { JobListing, SearchProfile, ActionLog, JobStatus } from '@openorbit/core/types'
import type { InlineKeyboardButton } from './telegram-bot'
import type { JobsRepo } from '@openorbit/ext-jobs/main/db/jobs-repo'
import type { ActionLogRepo } from '@openorbit/ext-jobs/main/db/action-log-repo'

// ---------------------------------------------------------------------------
// Job formatters
// ---------------------------------------------------------------------------

export function formatJobList(jobs: JobListing[], title: string): string {
  if (jobs.length === 0) {
    return `*${title}*\n\nNo jobs found.`
  }

  const lines = [`*${title}* (${jobs.length})`, '']
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    const score = job.matchScore != null ? ` | Match: ${job.matchScore}%` : ''
    const location = job.location ? ` | ${job.location}` : ''
    const salary = job.salary ? ` | ${job.salary}` : ''
    lines.push(`${i + 1}. *${escapeMarkdown(job.title)}*`)
    lines.push(`   ${escapeMarkdown(job.company)}${location}${salary}${score}`)
    lines.push('')
  }

  return truncate(lines.join('\n'))
}

export function formatJobDetail(job: JobListing): string {
  const lines = [
    `*${escapeMarkdown(job.title)}*`,
    `Company: ${escapeMarkdown(job.company)}`,
    `Platform: ${job.platform}`,
    `Location: ${job.location || 'N/A'}`,
    `Salary: ${job.salary || 'N/A'}`,
    `Type: ${job.jobType}`,
    `Status: ${job.status}`,
    `Match Score: ${job.matchScore != null ? `${job.matchScore}%` : 'N/A'}`,
    ''
  ]

  if (job.summary) {
    lines.push(`*Summary:* ${escapeMarkdown(job.summary)}`)
    lines.push('')
  }

  if (job.highlights) {
    lines.push(`*Highlights:* ${escapeMarkdown(job.highlights.join(', '))}`)
    lines.push('')
  }

  if (job.redFlags) {
    lines.push(`*Red Flags:* ${escapeMarkdown(job.redFlags.join(', '))}`)
    lines.push('')
  }

  lines.push(`[View Job](${job.url})`)

  return truncate(lines.join('\n'))
}

export function jobInlineKeyboard(jobId: string): InlineKeyboardButton[][] {
  return [
    [
      { text: 'Approve', callback_data: `approve:${jobId}` },
      { text: 'Reject', callback_data: `reject:${jobId}` }
    ]
  ]
}

// ---------------------------------------------------------------------------
// Profile formatters
// ---------------------------------------------------------------------------

export function formatProfileList(profiles: SearchProfile[]): string {
  if (profiles.length === 0) {
    return '*Search Profiles*\n\nNo profiles configured.'
  }

  const lines = [`*Search Profiles* (${profiles.length})`, '']
  for (const p of profiles) {
    const status = p.enabled ? 'enabled' : 'disabled'
    lines.push(`- *${escapeMarkdown(p.name)}* (${p.platform}) — ${status}`)
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Action log formatters
// ---------------------------------------------------------------------------

export function formatActionLog(entries: ActionLog[]): string {
  if (entries.length === 0) {
    return '*Action Log*\n\nNo recent actions.'
  }

  const lines = [`*Recent Actions* (${entries.length})`, '']
  for (const entry of entries) {
    const status = entry.success ? 'OK' : 'FAIL'
    const time = formatTime(entry.timestamp)
    lines.push(`${time} [${status}] ${escapeMarkdown(entry.intent)}`)
  }

  return truncate(lines.join('\n'))
}

// ---------------------------------------------------------------------------
// Status summary
// ---------------------------------------------------------------------------

export function formatStatusSummary(jobsRepo: JobsRepo, actionLogRepo: ActionLogRepo): string {
  try {
    const newJobs = jobsRepo.list({ status: 'new' as JobStatus })
    const approvedJobs = jobsRepo.list({ status: 'approved' as JobStatus })
    const appliedJobs = jobsRepo.list({ status: 'applied' as JobStatus })
    const recentActions = actionLogRepo.getRecent(1)

    const lines = [
      '*Status Summary*',
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
    return '*Status Summary*\n\nUnable to retrieve status.'
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape Telegram Markdown special characters. */
function escapeMarkdown(text: string): string {
  // In Markdown mode, only escape the chars that cause issues
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return timestamp
  }
}

function truncate(text: string): string {
  if (text.length <= 4096) return text
  return text.slice(0, 4080) + '\n\n_(truncated)_'
}
