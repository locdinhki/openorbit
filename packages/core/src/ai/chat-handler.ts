import type { JobListing } from '../types'
import type { AIService, AIMessage } from './provider-types'
import { buildJobContext } from './claude-service'
import { createLegacyAIService } from './compat'
import { UserProfileRepo } from '../db/user-profile-repo'
import { MemoryRepo } from '../db/memory-repo'
import { MemoryContextBuilder } from './memory-context'
import { extractAndSaveMemories } from './memory-extractor'
import { createLogger } from '../utils/logger'

const log = createLogger('ChatHandler')

const SYSTEM_PROMPT = `You are Claude, an AI assistant integrated into OpenOrbit — a tool that helps a software contractor find, analyze, and apply to job opportunities.

You can help with:
- Analyzing and comparing job listings
- Discussing whether a job is a good fit
- Strategizing about applications
- Answering questions about the job market
- Helping refine search criteria
- General career advice

Be direct, concise, and honest. When discussing jobs, reference specific details from the listing.
If you have context about the user's profile and a selected job, use it to give personalized advice.`

const MEMORY_INSTRUCTION = `

## Memory
When the user states a preference, makes a decision about their job search, shares personal info relevant to applications, or corrects you — silently record it using this exact format:
<memory category="preference">the fact</memory>

Categories:
- preference: job preferences, dealbreakers, salary expectations, work style
- company: facts about specific companies (culture, tech stack, reputation)
- pattern: behavioral patterns (e.g., "always rejects DevOps roles")
- answer: reusable answers to common application questions

Rules:
- Do NOT mention that you are recording memories
- Do NOT add memory tags for trivial statements or greetings
- Only record genuinely useful facts for future job search assistance
- One fact per tag — keep facts atomic and concise`

export class ChatHandler {
  private history: AIMessage[] = []
  private ai: AIService
  private userProfileRepo = new UserProfileRepo()
  private memoryRepo: MemoryRepo | null
  private memoryContext: MemoryContextBuilder | null

  constructor(ai?: AIService, memoryRepo?: MemoryRepo) {
    this.ai = ai ?? createLegacyAIService()
    this.memoryRepo = memoryRepo ?? null
    this.memoryContext = memoryRepo ? new MemoryContextBuilder(memoryRepo) : null
  }

  /** Send a message and get a response, maintaining conversation history */
  async sendMessage(message: string, selectedJob?: JobListing | null): Promise<string> {
    // Build system prompt with optional job context
    let systemPrompt = SYSTEM_PROMPT
    if (selectedJob) {
      const profile = this.userProfileRepo.get()
      const jobContext = buildJobContext(selectedJob, profile)
      systemPrompt += `\n\n## Currently Selected Job\n${jobContext}`
    }

    const profile = this.userProfileRepo.get()
    if (profile) {
      systemPrompt += `\n\nThe user's name is ${profile.name}. They are a ${profile.title} based in ${profile.location}.`
    }

    // Inject memory context
    if (this.memoryContext) {
      const memoryCtx = this.memoryContext.buildChatContext(message)
      if (memoryCtx) {
        systemPrompt += `\n\n${memoryCtx}`
      }
      systemPrompt += MEMORY_INSTRUCTION
    }

    // Add the user message to history
    this.history.push({ role: 'user', content: message })

    // Keep only last 20 messages to stay within context limits
    if (this.history.length > 20) {
      this.history = this.history.slice(-20)
    }

    try {
      const result = await this.ai.chat({
        systemPrompt,
        messages: this.history,
        tier: 'standard',
        task: 'chat'
      })

      // Extract and save memory facts, strip tags from response
      let content = result.content
      if (this.memoryRepo) {
        const extraction = extractAndSaveMemories(content, this.memoryRepo)
        content = extraction.cleanedResponse
      }

      // Add cleaned assistant response to history
      this.history.push({ role: 'assistant', content })

      return content
    } catch (err) {
      log.error('Chat failed', err)
      // Remove the user message if the request failed
      this.history.pop()
      throw err
    }
  }

  /** Clear conversation history */
  clearHistory(): void {
    this.history = []
  }

  /** Get current conversation history */
  getHistory(): AIMessage[] {
    return [...this.history]
  }
}
