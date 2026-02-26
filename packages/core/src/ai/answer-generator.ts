import type { JobListing, ClaudeAnswer } from '../types'
import type { AIService } from './provider-types'
import { buildJobContext } from './claude-service'
import { createLegacyAIService } from './compat'
import { UserProfileRepo } from '../db/user-profile-repo'
import { MemoryContextBuilder } from './memory-context'
import { createLogger } from '../utils/logger'

const log = createLogger('AnswerGenerator')

const SYSTEM_PROMPT = `You are an AI assistant helping a software contractor fill out job application forms. You generate answers to application questions that are specific to the job and the candidate's background.

When generating an answer, respond with ONLY valid JSON in this exact format:
{
  "answer": "<the answer to the question>",
  "confidence": <number 0-1>,
  "needsReview": <true/false>
}

Rules:
- Be specific to the job and candidate — never generic.
- Match the expected answer format (yes/no, short text, paragraph, etc.).
- If the question asks about salary expectations, use the candidate's target range.
- If the question is about authorization/visa, answer based on the profile.
- If you're not confident, set needsReview to true.
- Keep answers concise and professional.
- For "Why are you interested in this role?" type questions, reference specific aspects of the job.
- Frame contractor experience positively: fast ramp-up, independent delivery, diverse exposure.`

export class AnswerGenerator {
  private memoryContext = new MemoryContextBuilder()
  private ai: AIService
  private userProfileRepo = new UserProfileRepo()

  constructor(ai?: AIService) {
    this.ai = ai ?? createLegacyAIService()
  }

  /** Generate an answer to a single application question */
  async generateAnswer(
    question: string,
    job: JobListing,
    additionalContext?: string
  ): Promise<ClaudeAnswer> {
    const profile = this.userProfileRepo.get()
    const context = buildJobContext(job, profile)
    const memoryCtx = this.memoryContext.buildAnswerContext(question, job.company)

    const userMessage = `Generate an answer to this application question.

## Question
${question}

${additionalContext ? `## Additional Context\n${additionalContext}\n` : ''}
${context}
${memoryCtx}`

    try {
      const result = await this.ai.complete({
        systemPrompt: SYSTEM_PROMPT,
        userMessage,
        tier: 'standard',
        maxTokens: 512,
        task: 'generate_answer'
      })
      return this.parseAnswer(result.content)
    } catch (err) {
      log.error('Answer generation failed', err)
      throw err
    }
  }

  /** Generate answers for multiple questions */
  async generateAnswers(questions: string[], job: JobListing): Promise<Map<string, ClaudeAnswer>> {
    const results = new Map<string, ClaudeAnswer>()

    for (const question of questions) {
      try {
        const answer = await this.generateAnswer(question, job)
        results.set(question, answer)
      } catch (err) {
        log.error(`Failed to generate answer for: ${question}`, err)
        results.set(question, {
          answer: '',
          confidence: 0,
          needsReview: true
        })
      }

      // Brief delay between API calls
      await new Promise((resolve) => setTimeout(resolve, 300))
    }

    return results
  }

  private parseAnswer(response: string): ClaudeAnswer {
    let jsonStr = response.trim()
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim()
    }

    try {
      const parsed = JSON.parse(jsonStr)
      return {
        answer: String(parsed.answer || ''),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
        needsReview: Boolean(parsed.needsReview)
      }
    } catch {
      log.warn('Failed to parse answer JSON')
      return {
        answer: response.substring(0, 500),
        confidence: 0.3,
        needsReview: true
      }
    }
  }
}
