import type { JobListing, ClaudeAnalysis } from '../types'
import type { AIService } from './provider-types'
import { buildJobContext } from './claude-service'
import { createLegacyAIService } from './compat'
import { UserProfileRepo } from '../db/user-profile-repo'
import { MemoryContextBuilder } from './memory-context'
import { createLogger } from '../utils/logger'

const log = createLogger('JobAnalyzer')

const SYSTEM_PROMPT = `You are an AI assistant integrated into OpenOrbit, a tool that helps a software contractor find and apply to opportunities. You analyze job listings and provide honest, concise assessments.

When analyzing a job, respond with ONLY valid JSON in this exact format:
{
  "matchScore": <number 0-100>,
  "reasoning": "<2-3 sentence explanation of the score>",
  "summary": "<1-2 sentence job summary focusing on what matters to the candidate>",
  "redFlags": ["<red flag 1>", "<red flag 2>"],
  "highlights": ["<highlight 1>", "<highlight 2>"],
  "recommendedResume": "<name of most relevant resume or 'default'>"
}

Rules:
- Be honest with scores — don't inflate. A perfect match is rare.
- Red flags: low pay, unrealistic requirements, vague descriptions, high turnover signals, etc.
- Highlights: good pay, remote, interesting tech, growth opportunity, etc.
- Consider the contractor's background, skills, and preferences when scoring.
- If description is empty/minimal, note that as a red flag and give a lower score.`

export class JobAnalyzer {
  private memoryContext = new MemoryContextBuilder()
  private ai: AIService
  private userProfileRepo = new UserProfileRepo()

  constructor(ai?: AIService) {
    this.ai = ai ?? createLegacyAIService()
  }

  /** Analyze a single job listing */
  async analyze(job: JobListing): Promise<ClaudeAnalysis> {
    const profile = this.userProfileRepo.get()
    const context = buildJobContext(job, profile)
    const memoryCtx = this.memoryContext.buildJobAnalysisContext(job.title, job.company)

    const userMessage = `Analyze this job listing and return the JSON assessment.

${context}
${memoryCtx}`

    try {
      const result = await this.ai.complete({
        systemPrompt: SYSTEM_PROMPT,
        userMessage,
        tier: 'standard',
        maxTokens: 1024,
        task: 'score_job'
      })
      return this.parseAnalysis(result.content)
    } catch (err) {
      log.error('Job analysis failed', err)
      throw err
    }
  }

  /** Analyze multiple jobs in sequence (with rate limiting) */
  async analyzeBatch(
    jobs: JobListing[],
    onProgress?: (index: number, total: number) => void
  ): Promise<Map<string, ClaudeAnalysis>> {
    const results = new Map<string, ClaudeAnalysis>()

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      onProgress?.(i, jobs.length)

      try {
        const analysis = await this.analyze(job)
        results.set(job.id, analysis)
        log.info(`Analyzed ${i + 1}/${jobs.length}: ${job.title} — score: ${analysis.matchScore}`)
      } catch (err) {
        log.error(`Failed to analyze job ${job.id}: ${job.title}`, err)
        // Continue with next job
      }

      // Brief delay between API calls
      if (i < jobs.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    return results
  }

  private parseAnalysis(response: string): ClaudeAnalysis {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    try {
      const parsed = JSON.parse(jsonStr)
      return {
        matchScore: Math.max(0, Math.min(100, Number(parsed.matchScore) || 0)),
        reasoning: String(parsed.reasoning || ''),
        summary: String(parsed.summary || ''),
        redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags.map(String) : [],
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights.map(String) : [],
        recommendedResume: String(parsed.recommendedResume || 'default')
      }
    } catch {
      log.warn('Failed to parse analysis JSON, extracting manually')
      // Fallback: try to extract key fields from text
      return {
        matchScore: 50,
        reasoning: response.substring(0, 200),
        summary: 'Analysis parsing failed — review manually',
        redFlags: ['Could not parse AI analysis'],
        highlights: [],
        recommendedResume: 'default'
      }
    }
  }
}
