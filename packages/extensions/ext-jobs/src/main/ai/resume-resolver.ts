import type Database from 'better-sqlite3'
import type { SearchProfile, JobListing } from '@openorbit/core/types'
import type { AIService } from '@openorbit/core/ai/provider-types'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { ResumeAnalysisRepo } from '../db/resume-analysis-repo'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('ResumeResolver')

interface ResumeEntry {
  name: string
  path: string
  isDefault: boolean
  addedAt: string
}

/**
 * Resolves a SearchProfile's `resumeFile` value to an actual file path.
 *
 * - "auto"  → AI picks the best resume from analyzed resumes for the given job
 * - ""      → use the default (isDefault=true) resume
 * - "<name>" → match by resume name from the global resume list
 * - "/full/path" → legacy absolute path, use directly
 */
export class ResumeResolver {
  private analysisRepo: ResumeAnalysisRepo
  private settingsRepo: SettingsRepo

  constructor(
    db: Database.Database,
    private ai: AIService
  ) {
    this.analysisRepo = new ResumeAnalysisRepo(db)
    this.settingsRepo = new SettingsRepo()
  }

  async resolve(profile: SearchProfile, job: JobListing): Promise<string> {
    const resumeFile = profile.application.resumeFile
    const resumes = this.getResumeList()

    if (resumes.length === 0) return ''

    // Auto-selection: let AI pick the best resume
    if (!resumeFile || resumeFile === 'auto') {
      if (resumeFile === 'auto' && resumes.length > 1) {
        return this.pickBestResume(job, resumes)
      }
      return this.defaultResumePath(resumes)
    }

    // Legacy: looks like a file path, use directly
    if (resumeFile.includes('/') || resumeFile.includes('\\')) {
      return resumeFile
    }

    // Match by resume name
    const matched = resumes.find((r) => r.name === resumeFile)
    if (matched) return matched.path

    // Fallback to default
    log.warn(`Resume "${resumeFile}" not found in list, using default`)
    return this.defaultResumePath(resumes)
  }

  private async pickBestResume(job: JobListing, resumes: ResumeEntry[]): Promise<string> {
    const analyses = this.analysisRepo.list()
    if (analyses.length === 0) {
      log.info('No resume analyses available, using default resume')
      return this.defaultResumePath(resumes)
    }

    const resumeSummaries = analyses
      .map(
        (a) =>
          `- "${a.resumeName}": skills: ${a.analysis.skills.slice(0, 10).join(', ')}; ` +
          `target roles: ${a.analysis.targetRoles.join(', ')}; ` +
          `seniority: ${a.analysis.seniorityLevel}`
      )
      .join('\n')

    const jobSkills = (job.skills ?? []).slice(0, 15).join(', ')

    try {
      const result = await this.ai.complete({
        systemPrompt:
          'You select the best resume for a job application. Respond with ONLY the exact resume filename, nothing else.',
        userMessage: `Job: ${job.title} at ${job.company}\nRequired skills: ${jobSkills}\nJob description (first 400 chars): ${job.description?.substring(0, 400) ?? ''}\n\nAvailable resumes:\n${resumeSummaries}\n\nReturn ONLY the exact resume filename.`,
        tier: 'fast',
        maxTokens: 100,
        task: 'generate_answer'
      })

      const pickedName = result.content.trim().replace(/^["']|["']$/g, '')
      const matched = resumes.find((r) => r.name === pickedName)
      if (matched) {
        log.info(`AI selected resume "${pickedName}" for "${job.title}"`)
        return matched.path
      }
    } catch (err) {
      log.warn('AI resume selection failed, using default', err)
    }

    return this.defaultResumePath(resumes)
  }

  private defaultResumePath(resumes: ResumeEntry[]): string {
    const def = resumes.find((r) => r.isDefault) ?? resumes[0]
    return def?.path ?? ''
  }

  private getResumeList(): ResumeEntry[] {
    const raw = this.settingsRepo.get('resumes')
    if (!raw) return []
    try {
      return JSON.parse(raw) as ResumeEntry[]
    } catch {
      return []
    }
  }
}
