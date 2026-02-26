// ============================================================================
// OpenOrbit — iMessage AI Gateway
//
// Routes incoming iMessage messages through the Claude Agent SDK with
// in-process MCP tools for OpenOrbit data access.
// ============================================================================

import { query } from '@anthropic-ai/claude-agent-sdk'
import type { SDKResultSuccess, SDKResultError } from '@anthropic-ai/claude-agent-sdk'
import type Database from 'better-sqlite3'
import type { Logger } from '@openorbit/core/extensions/types'
import type { JobStatus } from '@openorbit/core/types'
import { MemoryRepo } from '@openorbit/core/db/memory-repo'
import { MemoryContextBuilder } from '@openorbit/core/ai/memory-context'
import { extractAndSaveMemories } from '@openorbit/core/ai/memory-extractor'
import { JobsRepo } from '@openorbit/ext-jobs/main/db/jobs-repo'
import { ProfilesRepo } from '@openorbit/ext-jobs/main/db/profiles-repo'
import { ActionLogRepo } from '@openorbit/ext-jobs/main/db/action-log-repo'
import { ApplicationsRepo } from '@openorbit/ext-jobs/main/db/applications-repo'
import {
  formatJobList,
  formatProfileList,
  formatActionLog,
  formatStatusSummary
} from './formatters'

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are OpenOrbit, a personal job search assistant running on the user's Mac.
You help the user manage their automated job search from their phone via iMessage.

You have access to tools that let you:
- List and search discovered jobs
- View job details
- Approve or reject jobs for application
- List search profiles
- View submitted applications
- Check recent activity (action log)

When listing jobs, present them clearly with title, company, and match score.
When the user wants to approve or reject a job, find it first if they describe it by name.
Keep responses concise — this is a mobile messaging interface.
Use plain text formatting with emoji. Do not use markdown.`

// ---------------------------------------------------------------------------
// AIGateway
// ---------------------------------------------------------------------------

export interface AIGatewayDeps {
  db: Database.Database
  log: Logger
}

export class AIGateway {
  private db: Database.Database
  private log: Logger
  private jobsRepo: JobsRepo
  private profilesRepo: ProfilesRepo
  private actionLogRepo: ActionLogRepo
  private applicationsRepo: ApplicationsRepo
  private memoryRepo: MemoryRepo
  private memoryContext: MemoryContextBuilder

  constructor(deps: AIGatewayDeps) {
    this.db = deps.db
    this.log = deps.log
    this.jobsRepo = new JobsRepo(deps.db)
    this.profilesRepo = new ProfilesRepo(deps.db)
    this.actionLogRepo = new ActionLogRepo(deps.db)
    this.applicationsRepo = new ApplicationsRepo(deps.db)
    this.memoryRepo = new MemoryRepo()
    this.memoryContext = new MemoryContextBuilder(this.memoryRepo)
  }

  async processMessage(text: string): Promise<string> {
    this.log.info(`AI Gateway processing: "${text.slice(0, 80)}..."`)

    // Build system prompt with tool data + memory context
    const toolPrompt = this.buildToolPrompt()
    let systemPrompt = SYSTEM_PROMPT + '\n\n' + toolPrompt

    const memoryCtx = this.memoryContext.buildChatContext(text)
    if (memoryCtx) {
      systemPrompt += '\n\n' + memoryCtx
    }

    const env = cleanEnv()

    try {
      const q = query({
        prompt: text,
        options: {
          systemPrompt,
          model: 'sonnet',
          maxTurns: 1,
          permissionMode: 'plan' as const,
          env
        }
      })

      for await (const msg of q) {
        if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            const success = msg as SDKResultSuccess
            const raw = success.result || 'I processed your request but have nothing to report.'
            const { cleanedResponse } = extractAndSaveMemories(raw, this.memoryRepo)
            return cleanedResponse
          } else {
            const error = msg as SDKResultError
            this.log.error('Agent SDK error:', error.errors)
            return 'Sorry, I encountered an error processing your request.'
          }
        }
      }

      return 'Sorry, I could not process your request.'
    } catch (err) {
      this.log.error('AI Gateway error:', err)
      return 'Sorry, something went wrong. Please try again.'
    }
  }

  /**
   * Process a callback action.
   * Format: "approve:<jobId>" or "reject:<jobId>"
   */
  async processCallback(data: string): Promise<string> {
    const [action, jobId] = data.split(':')
    if (!jobId) return 'Invalid action.'

    try {
      if (action === 'approve') {
        this.jobsRepo.updateStatus(jobId, 'approved')
        const job = this.jobsRepo.getById(jobId)
        return job ? `Approved: ${job.title} at ${job.company}` : `Job ${jobId} approved.`
      }

      if (action === 'reject') {
        this.jobsRepo.updateStatus(jobId, 'rejected')
        const job = this.jobsRepo.getById(jobId)
        return job ? `Rejected: ${job.title} at ${job.company}` : `Job ${jobId} rejected.`
      }

      return 'Unknown action.'
    } catch (err) {
      this.log.error('Callback processing error:', err)
      return 'Error processing action.'
    }
  }

  /**
   * Try to handle the message with direct tool dispatch first.
   * Falls back to AI processing for natural language queries.
   */
  async handleMessage(text: string): Promise<string> {
    const lower = text.trim().toLowerCase()

    // Direct command shortcuts for common operations
    const directResult = this.tryDirectCommand(lower)
    if (directResult !== null) return directResult

    // Fall back to AI for natural language processing
    return this.processMessage(text)
  }

  // -------------------------------------------------------------------------
  // Direct commands (fast path — no AI needed)
  // -------------------------------------------------------------------------

  private tryDirectCommand(text: string): string | null {
    if (text === '/jobs' || text === '/new' || text === 'new jobs' || text === 'jobs') {
      const jobs = this.jobsRepo.list({ status: 'new' as JobStatus, limit: 10 })
      return formatJobList(jobs, 'New Jobs')
    }

    if (text === '/approved') {
      const jobs = this.jobsRepo.list({ status: 'approved' as JobStatus, limit: 10 })
      return formatJobList(jobs, 'Approved Jobs')
    }

    if (text === '/profiles') {
      const profiles = this.profilesRepo.list()
      return formatProfileList(profiles)
    }

    if (text === '/status') {
      return formatStatusSummary(this.jobsRepo, this.actionLogRepo)
    }

    if (text === '/log') {
      const entries = this.actionLogRepo.getRecent(10)
      return formatActionLog(entries)
    }

    if (text === '/applied') {
      const apps = this.applicationsRepo.listApplied({ limit: 10 })
      return formatJobList(apps, 'Applied Jobs')
    }

    if (text === '/help') {
      return [
        'OpenOrbit Commands',
        '',
        '/jobs \u2014 List new jobs',
        '/approved \u2014 List approved jobs',
        '/applied \u2014 List applied jobs',
        '/profiles \u2014 List search profiles',
        '/status \u2014 Automation status',
        '/log \u2014 Recent action log',
        '/help \u2014 Show this help',
        '',
        'Or just type naturally:',
        '"any new jobs?" "approve the stripe one" "what\'s the status?"'
      ].join('\n')
    }

    // Handle approve/reject by number: "approve 1", "reject 2"
    const approveMatch = text.match(/^approve\s+(\d+)$/)
    if (approveMatch) {
      const idx = parseInt(approveMatch[1], 10) - 1
      const jobs = this.jobsRepo.list({ status: 'new' as JobStatus, limit: 10 })
      if (idx >= 0 && idx < jobs.length) {
        return this.processCallback(`approve:${jobs[idx].id}`)
      }
      return `Job #${approveMatch[1]} not found.`
    }

    const rejectMatch = text.match(/^reject\s+(\d+)$/)
    if (rejectMatch) {
      const idx = parseInt(rejectMatch[1], 10) - 1
      const jobs = this.jobsRepo.list({ status: 'new' as JobStatus, limit: 10 })
      if (idx >= 0 && idx < jobs.length) {
        return this.processCallback(`reject:${jobs[idx].id}`)
      }
      return `Job #${rejectMatch[1]} not found.`
    }

    return null
  }

  // -------------------------------------------------------------------------
  // Tool prompt builder
  // -------------------------------------------------------------------------

  private buildToolPrompt(): string {
    return [
      "You have access to the following data about the user's job search.",
      'Use this information to answer their questions.',
      '',
      'Current data:',
      this.getDataSnapshot()
    ].join('\n')
  }

  private getDataSnapshot(): string {
    try {
      const newJobs = this.jobsRepo.list({ status: 'new' as JobStatus, limit: 5 })
      const approvedJobs = this.jobsRepo.list({ status: 'approved' as JobStatus, limit: 5 })
      const recentLog = this.actionLogRepo.getRecent(5)
      const profiles = this.profilesRepo.list()

      const sections: string[] = []

      if (newJobs.length > 0) {
        sections.push(`New jobs (${newJobs.length} shown):`)
        for (const job of newJobs) {
          sections.push(
            `  - [${job.id}] "${job.title}" at ${job.company} (score: ${job.matchScore ?? 'N/A'})`
          )
        }
      } else {
        sections.push('No new jobs found.')
      }

      if (approvedJobs.length > 0) {
        sections.push(`\nApproved jobs (${approvedJobs.length} shown):`)
        for (const job of approvedJobs) {
          sections.push(`  - [${job.id}] "${job.title}" at ${job.company}`)
        }
      }

      if (profiles.length > 0) {
        sections.push(
          `\nSearch profiles: ${profiles.map((p) => `${p.name} (${p.platform})`).join(', ')}`
        )
      }

      if (recentLog.length > 0) {
        sections.push(`\nRecent actions (${recentLog.length}):`)
        for (const entry of recentLog) {
          sections.push(
            `  - ${entry.timestamp}: ${entry.intent} (${entry.success ? 'success' : 'failed'})`
          )
        }
      }

      return sections.join('\n')
    } catch (err) {
      this.log.error('Error building data snapshot:', err)
      return 'Unable to load current data.'
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, val] of Object.entries(process.env)) {
    if (key === 'CLAUDECODE' || key === 'CLAUDE_CODE') continue
    if (val !== undefined) env[key] = val
  }
  return env
}
