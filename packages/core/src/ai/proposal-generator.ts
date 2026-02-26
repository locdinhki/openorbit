import type { JobListing, UpworkProjectDetails } from '../types'
import type { AIService } from './provider-types'
import { buildJobContext } from './claude-service'
import { createLegacyAIService } from './compat'
import { UserProfileRepo } from '../db/user-profile-repo'
import { MemoryContextBuilder } from './memory-context'
import { createLogger } from '../utils/logger'

const log = createLogger('ProposalGenerator')

const SYSTEM_PROMPT = `You are an AI assistant helping a freelance software contractor write proposals for Upwork projects. Generate compelling, specific proposals that stand out.

When generating a proposal, respond with ONLY valid JSON in this exact format:
{
  "coverLetter": "<the proposal cover letter text>",
  "suggestedBid": <number or null>,
  "estimatedDuration": "<string or null>",
  "confidence": <number 0-1>,
  "needsReview": <true/false>
}

Rules:
- Open with a hook that shows you've read the project description.
- Reference specific technologies or requirements from the job.
- Highlight 1-2 relevant past experiences (concrete, not vague).
- Keep proposals between 100-300 words — Upwork clients prefer concise.
- Do NOT use buzzwords like "passionate", "dedicated", "guru", "rockstar".
- End with a specific next step or question about the project.
- For bid amounts: suggest a competitive rate based on the project budget. If hourly, suggest a rate within the posted range. If fixed, suggest based on scope.
- If you can't determine a reasonable bid, set suggestedBid to null.
- Set needsReview to true for high-value projects ($5000+) or ambiguous requirements.`

export interface ProposalResult {
  coverLetter: string
  suggestedBid: number | null
  estimatedDuration: string | null
  confidence: number
  needsReview: boolean
}

export class ProposalGenerator {
  private memoryContext = new MemoryContextBuilder()
  private ai: AIService
  private userProfileRepo = new UserProfileRepo()

  constructor(ai?: AIService) {
    this.ai = ai ?? createLegacyAIService()
  }

  async generateProposal(
    job: JobListing,
    projectDetails?: UpworkProjectDetails,
    additionalContext?: string
  ): Promise<ProposalResult> {
    const profile = this.userProfileRepo.get()
    const context = buildJobContext(job, profile)
    const memoryCtx = this.memoryContext.buildAnswerContext(job.title, job.company)

    let budgetSection = ''
    if (projectDetails) {
      budgetSection = `\n## Project Details
- Budget type: ${projectDetails.budgetType}${projectDetails.budgetMin != null ? `\n- Budget range: $${projectDetails.budgetMin} - $${projectDetails.budgetMax}` : ''}${projectDetails.budgetFixed != null ? `\n- Fixed budget: $${projectDetails.budgetFixed}` : ''}${projectDetails.timeline ? `\n- Timeline: ${projectDetails.timeline}` : ''}${projectDetails.clientRating != null ? `\n- Client rating: ${projectDetails.clientRating}/5` : ''}${projectDetails.clientTotalSpent ? `\n- Client total spent: ${projectDetails.clientTotalSpent}` : ''}${projectDetails.experienceLevel ? `\n- Experience level: ${projectDetails.experienceLevel}` : ''}${projectDetails.skillsRequired.length > 0 ? `\n- Required skills: ${projectDetails.skillsRequired.join(', ')}` : ''}`
    }

    const userMessage = `Generate a proposal for this Upwork project.

${context}${budgetSection}
${additionalContext ? `\n## Additional Context\n${additionalContext}\n` : ''}${memoryCtx}`

    try {
      const result = await this.ai.complete({
        systemPrompt: SYSTEM_PROMPT,
        userMessage,
        tier: 'premium',
        maxTokens: 1024,
        task: 'generate_proposal'
      })
      return this.parseProposal(result.content)
    } catch (err) {
      log.error('Proposal generation failed', err)
      throw err
    }
  }

  private parseProposal(response: string): ProposalResult {
    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    try {
      const parsed = JSON.parse(jsonStr)
      return {
        coverLetter: String(parsed.coverLetter || ''),
        suggestedBid: parsed.suggestedBid != null ? Number(parsed.suggestedBid) : null,
        estimatedDuration: parsed.estimatedDuration || null,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        needsReview: Boolean(parsed.needsReview)
      }
    } catch {
      log.warn('Failed to parse proposal JSON, using raw response')
      return {
        coverLetter: response.substring(0, 2000),
        suggestedBid: null,
        estimatedDuration: null,
        confidence: 0.3,
        needsReview: true
      }
    }
  }
}
