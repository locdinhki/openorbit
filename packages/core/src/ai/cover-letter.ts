import type { JobListing } from '../types'
import type { AIService } from './provider-types'
import { buildJobContext } from './claude-service'
import { createLegacyAIService } from './compat'
import { UserProfileRepo } from '../db/user-profile-repo'
import { createLogger } from '../utils/logger'

const log = createLogger('CoverLetterGenerator')

const SYSTEM_PROMPT = `You are an AI assistant helping a software contractor write cover letters. Generate a professional, compelling cover letter that is specific to the job and highlights the candidate's relevant experience.

Rules:
- Keep it concise: 3-4 short paragraphs max.
- Open strong — mention the specific role and company.
- Highlight 2-3 most relevant skills/experiences from the candidate's profile.
- Frame contractor experience positively: diverse exposure, fast ramp-up, delivering independently.
- Close with enthusiasm and a call to action.
- Do NOT use cliches like "passionate about" or "excited to apply".
- Write in a professional but personable tone.
- Return ONLY the cover letter text, no JSON or markdown formatting.`

export class CoverLetterGenerator {
  private ai: AIService
  private userProfileRepo = new UserProfileRepo()

  constructor(ai?: AIService) {
    this.ai = ai ?? createLegacyAIService()
  }

  /** Generate a cover letter for a specific job */
  async generate(job: JobListing, template?: string): Promise<string> {
    const profile = this.userProfileRepo.get()
    const context = buildJobContext(job, profile)

    let userMessage = `Write a cover letter for this position.

${context}`

    if (template) {
      userMessage += `\n\n## Template/Style Guide\n${template}`
    }

    try {
      const result = await this.ai.complete({
        systemPrompt: SYSTEM_PROMPT,
        userMessage,
        tier: 'premium',
        maxTokens: 1024,
        task: 'cover_letter'
      })
      return result.content.trim()
    } catch (err) {
      log.error('Cover letter generation failed', err)
      throw err
    }
  }
}
