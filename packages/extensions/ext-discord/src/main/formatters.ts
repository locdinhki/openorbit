// ============================================================================
// OpenOrbit — Discord Message Formatters
//
// Format OpenOrbit data for Discord. Uses **bold** markdown, embeds for
// rich job cards, and button components for approve/reject actions.
// Discord has a 2000-char message limit.
// ============================================================================

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import type { JobListing, SearchProfile, ActionLog } from '@openorbit/core/types'
import type { JobsRepo } from '@openorbit/ext-jobs/main/db/jobs-repo'
import type { ActionLogRepo } from '@openorbit/ext-jobs/main/db/action-log-repo'

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLOR_NEW = 0x2ecc71 // green
const COLOR_APPROVED = 0x3498db // blue
const COLOR_REJECTED = 0xe74c3c // red
const COLOR_DEFAULT = 0x95a5a6 // gray

function statusColor(status: string): number {
  switch (status) {
    case 'new':
      return COLOR_NEW
    case 'approved':
      return COLOR_APPROVED
    case 'rejected':
      return COLOR_REJECTED
    default:
      return COLOR_DEFAULT
  }
}

// ---------------------------------------------------------------------------
// Job formatters
// ---------------------------------------------------------------------------

export function formatJobEmbed(job: JobListing, index?: number): EmbedBuilder {
  const title = index != null ? `${index + 1}. ${job.title}` : job.title
  const embed = new EmbedBuilder().setTitle(title).setColor(statusColor(job.status))

  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: 'Company', value: job.company, inline: true },
    { name: 'Platform', value: job.platform, inline: true }
  ]

  if (job.location) fields.push({ name: 'Location', value: job.location, inline: true })
  if (job.salary) fields.push({ name: 'Salary', value: job.salary, inline: true })
  if (job.matchScore != null)
    fields.push({ name: 'Match', value: `${job.matchScore}%`, inline: true })

  embed.addFields(fields)

  if (job.url) embed.setURL(job.url)

  return embed
}

export function jobActionRow(jobId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve:${jobId}`)
      .setLabel('Approve')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject:${jobId}`)
      .setLabel('Reject')
      .setStyle(ButtonStyle.Danger)
  )
}

export interface DiscordJobListResult {
  content: string
  embeds: EmbedBuilder[]
  components: ActionRowBuilder<ButtonBuilder>[]
}

export function formatJobList(jobs: JobListing[], title: string): DiscordJobListResult {
  if (jobs.length === 0) {
    return { content: `**${title}**\n\nNo jobs found.`, embeds: [], components: [] }
  }

  const content = `**${title}** (${jobs.length})`
  // Discord allows max 10 embeds per message; limit to 5 for readability
  const shown = jobs.slice(0, 5)
  const embeds = shown.map((job, i) => formatJobEmbed(job, i))
  // Max 5 action rows per message
  const components = shown.map((job) => jobActionRow(job.id))

  return { content, embeds, components }
}

export function formatJobDetail(job: JobListing): EmbedBuilder {
  const embed = formatJobEmbed(job)

  if (job.summary) embed.setDescription(job.summary)

  const extra: { name: string; value: string; inline: boolean }[] = []
  if (job.highlights)
    extra.push({
      name: 'Highlights',
      value: truncateField(job.highlights.join(', ')),
      inline: false
    })
  if (job.redFlags)
    extra.push({ name: 'Red Flags', value: truncateField(job.redFlags.join(', ')), inline: false })
  if (extra.length > 0) embed.addFields(extra)

  return embed
}

// ---------------------------------------------------------------------------
// Profile formatters
// ---------------------------------------------------------------------------

export function formatProfileList(profiles: SearchProfile[]): string {
  if (profiles.length === 0) {
    return '**Search Profiles**\n\nNo profiles configured.'
  }

  const lines = [`**Search Profiles** (${profiles.length})`, '']
  for (const p of profiles) {
    const icon = p.enabled ? '\u2705' : '\u274C'
    lines.push(`${icon} **${p.name}** (${p.platform})`)
  }

  return truncate(lines.join('\n'))
}

// ---------------------------------------------------------------------------
// Action log formatters
// ---------------------------------------------------------------------------

export function formatActionLog(entries: ActionLog[]): string {
  if (entries.length === 0) {
    return '**Action Log**\n\nNo recent actions.'
  }

  const lines = [`**Recent Actions** (${entries.length})`, '']
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
    const newJobs = jobsRepo.list({ status: 'new' })
    const approvedJobs = jobsRepo.list({ status: 'approved' })
    const appliedJobs = jobsRepo.list({ status: 'applied' })
    const recentActions = actionLogRepo.getRecent(1)

    const lines = [
      '**Status Summary**',
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
    return '**Status Summary**\n\nUnable to retrieve status.'
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
  if (text.length <= 2000) return text
  return text.slice(0, 1980) + '\n\n_(truncated)_'
}

function truncateField(text: string): string {
  if (text.length <= 1024) return text
  return text.slice(0, 1010) + '...'
}

/** Split text into chunks respecting Discord's 2000-char limit. */
export function chunkMessage(text: string, maxLen = 2000): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }

    const splitIdx = remaining.lastIndexOf('\n\n', maxLen)
    if (splitIdx > maxLen / 2) {
      chunks.push(remaining.slice(0, splitIdx))
      remaining = remaining.slice(splitIdx + 2)
    } else {
      chunks.push(remaining.slice(0, maxLen))
      remaining = remaining.slice(maxLen)
    }
  }

  return chunks
}
