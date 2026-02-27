// ============================================================================
// ext-jobs — AI Chat Handler (agentic tool-calling loop)
//
// Upgrades the core ChatHandler with tool-calling support so the AI can
// query actual job data (jobs, profiles, answer templates) via repos.
// ============================================================================

import type {
  AIService,
  AIToolCall,
  AIToolResult,
  AIMessage
} from '@openorbit/core/ai/provider-types'
import type { JobListing, JobStatus } from '@openorbit/core/types'
import { buildJobContext } from '@openorbit/core/ai/claude-service'
import { UserProfileRepo } from '@openorbit/core/db/user-profile-repo'
import { MemoryRepo } from '@openorbit/core/db/memory-repo'
import { MemoryContextBuilder } from '@openorbit/core/ai/memory-context'
import { extractAndSaveMemories } from '@openorbit/core/ai/memory-extractor'
import { createLogger } from '@openorbit/core/utils/logger'
import { JOBS_TOOLS, JOBS_SYSTEM_PROMPT } from './jobs-tools'
import type { ChatSessionsRepo } from '../db/chat-sessions-repo'
import type { ProfilesRepo } from '../db/profiles-repo'
import type { JobsRepo } from '../db/jobs-repo'
import type { ActionLogRepo } from '../db/action-log-repo'
import type { AnswersRepo } from '../db/answers-repo'

const log = createLogger('JobsChatHandler')
const MAX_HISTORY = 20
const MAX_TOOL_ROUNDS = 5

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

export class JobsChatHandler {
  private history: AIMessage[] = []
  private userProfileRepo: UserProfileRepo
  private memoryContext: MemoryContextBuilder | null
  private sessionsRepo: ChatSessionsRepo | null = null
  private activeSessionId: string | null = null

  constructor(
    private ai: AIService,
    private jobsRepo: JobsRepo,
    private profilesRepo: ProfilesRepo,
    private actionLogRepo: ActionLogRepo,
    private answersRepo: AnswersRepo,
    private memoryRepo: MemoryRepo | null = null,
    userProfileRepo?: UserProfileRepo
  ) {
    this.userProfileRepo = userProfileRepo ?? new UserProfileRepo()
    this.memoryContext = memoryRepo ? new MemoryContextBuilder(memoryRepo) : null
  }

  setSessionsRepo(repo: ChatSessionsRepo): void {
    this.sessionsRepo = repo
  }

  getActiveSessionId(): string | null {
    return this.activeSessionId
  }

  setActiveSessionId(id: string | null): void {
    this.activeSessionId = id
  }

  loadSession(sessionId: string): void {
    if (!this.sessionsRepo) return
    const messages = this.sessionsRepo.getMessages(sessionId)
    this.history = messages.map((m) => ({ role: m.role, content: m.content }))
    this.activeSessionId = sessionId
  }

  async sendMessage(message: string, selectedJob?: JobListing | null): Promise<string> {
    // Build system prompt with optional job + profile + memory context
    let systemPrompt = JOBS_SYSTEM_PROMPT

    if (selectedJob) {
      const profile = this.userProfileRepo.get()
      const jobContext = buildJobContext(selectedJob, profile)
      systemPrompt += `\n\n## Currently Selected Job\n${jobContext}`
    }

    const profile = this.userProfileRepo.get()
    if (profile) {
      systemPrompt += `\n\nThe user's name is ${profile.name}. They are a ${profile.title} based in ${profile.location}.`
    }

    if (this.memoryContext) {
      const memoryCtx = this.memoryContext.buildChatContext(message)
      if (memoryCtx) {
        systemPrompt += `\n\n${memoryCtx}`
      }
      systemPrompt += MEMORY_INSTRUCTION
    }

    // Add user message and trim history
    this.history.push({ role: 'user', content: message })
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY)
    }

    try {
      // Check if provider supports tool calling
      const provider = this.ai.getProvider()
      let content: string

      if (provider?.capabilities.toolCalling && provider.completeWithTools) {
        content = await this.agenticLoop(message, systemPrompt, {
          completeWithTools: provider.completeWithTools.bind(provider)
        })
      } else {
        content = await this.simpleFallback(systemPrompt)
      }

      // Extract and save memory facts, strip tags from response
      if (this.memoryRepo) {
        const extraction = extractAndSaveMemories(content, this.memoryRepo)
        content = extraction.cleanedResponse
      }

      this.history.push({ role: 'assistant', content })

      // Persist to DB if session-aware
      if (this.sessionsRepo && this.activeSessionId) {
        try {
          this.sessionsRepo.addMessage(this.activeSessionId, 'user', message)
          this.sessionsRepo.addMessage(this.activeSessionId, 'assistant', content)

          // Auto-title: rename "New Chat" to first 80 chars of user message
          const session = this.sessionsRepo.getById(this.activeSessionId)
          if (session && session.title === 'New Chat') {
            const title = message.length > 80 ? message.slice(0, 77) + '...' : message
            this.sessionsRepo.rename(this.activeSessionId, title)
          }
        } catch (persistErr) {
          log.error('Failed to persist chat messages', persistErr)
        }
      }

      return content
    } catch (err) {
      log.error('Chat failed', err)
      this.history.pop() // Remove the user message on failure
      throw err
    }
  }

  private async agenticLoop(
    message: string,
    systemPrompt: string,
    provider: {
      completeWithTools: NonNullable<
        NonNullable<ReturnType<AIService['getProvider']>>['completeWithTools']
      >
    }
  ): Promise<string> {
    let toolResults: AIToolResult[] = []
    let rounds = 0

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++

      // Build user message with any tool results appended
      const userMsg =
        toolResults.length > 0
          ? `${message}\n\n[Tool Results]\n${toolResults.map((r) => `${r.toolCallId}: ${r.content}`).join('\n')}`
          : message

      const response = await provider.completeWithTools({
        systemPrompt,
        userMessage: userMsg,
        tools: JOBS_TOOLS,
        tier: 'standard',
        task: 'jobs-chat'
      })

      if (response.stopReason === 'end_turn' || response.toolCalls.length === 0) {
        return response.content
      }

      // Execute tool calls
      toolResults = []
      for (const call of response.toolCalls) {
        const result = await this.executeTool(call)
        toolResults.push(result)
      }
    }

    return 'I ran into a limit processing your request. Here is what I found so far.'
  }

  private async simpleFallback(systemPrompt: string): Promise<string> {
    // Gather a data snapshot for context
    const jobCounts = {
      new: this.jobsRepo.count('new'),
      reviewed: this.jobsRepo.count('reviewed'),
      approved: this.jobsRepo.count('approved'),
      applied: this.jobsRepo.count('applied')
    }
    const profiles = this.profilesRepo.list()
    const recentActions = this.actionLogRepo.getRecent(10)

    const snapshot = [
      `Jobs: ${jobCounts.new} new, ${jobCounts.reviewed} reviewed, ${jobCounts.approved} approved, ${jobCounts.applied} applied`,
      `Profiles (${profiles.length}): ${profiles.map((p) => `${p.name} [${p.platform}]${p.enabled ? '' : ' (disabled)'}`).join(', ') || 'none'}`,
      `Recent actions: ${recentActions.length} logged`
    ].join('\n')

    const response = await this.ai.chat({
      systemPrompt: `${systemPrompt}\n\nCurrent data snapshot:\n${snapshot}`,
      messages: this.history,
      tier: 'standard',
      task: 'jobs-chat'
    })

    return response.content
  }

  private async executeTool(call: AIToolCall): Promise<AIToolResult> {
    try {
      const result = this.dispatchTool(call.name, call.input)
      return { toolCallId: call.id, content: JSON.stringify(result) }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { toolCallId: call.id, content: `Error: ${message}`, isError: true }
    }
  }

  private dispatchTool(name: string, input: Record<string, unknown>): unknown {
    switch (name) {
      case 'list_jobs': {
        const limit = (input.limit as number) ?? 10
        return this.jobsRepo.list({
          status: input.status as JobStatus | JobStatus[] | undefined,
          platform: input.platform as string | undefined,
          minScore: input.minScore as number | undefined,
          limit
        })
      }
      case 'get_job': {
        return this.jobsRepo.getById(input.jobId as string)
      }
      case 'list_profiles': {
        return this.profilesRepo.list()
      }
      case 'get_profile': {
        return this.profilesRepo.getById(input.profileId as string)
      }
      case 'list_answer_templates': {
        return this.answersRepo.list(input.platform as string | undefined)
      }
      case 'find_answer': {
        return this.answersRepo.findMatch(input.question as string)
      }
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  clearHistory(): void {
    this.history = []
    this.activeSessionId = null
  }

  getHistory(): AIMessage[] {
    return [...this.history]
  }
}
