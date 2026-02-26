import { createHash } from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import type { ClaudeTask, JobListing, UserProfile } from '../types'
import {
  CLAUDE_MODELS,
  MAX_API_RETRY_ATTEMPTS,
  MAX_BACKOFF_MS,
  INITIAL_BACKOFF_MS
} from '../constants'
import { AIServiceError, AuthenticationError } from '../errors'
import { SettingsRepo } from '../db/settings-repo'
import { UserProfileRepo } from '../db/user-profile-repo'
import { ApiUsageRepo } from '../db/api-usage-repo'
import { createLogger } from '../utils/logger'

const log = createLogger('ClaudeService')

function selectModel(task: ClaudeTask): string {
  switch (task) {
    case 'score_job':
    case 'summarize_job':
    case 'generate_answer':
    case 'chat':
    case 'repair_hint':
      return CLAUDE_MODELS.SONNET
    case 'cover_letter':
    case 'compare_jobs':
    case 'generate_hints':
    case 'generate_proposal':
      return CLAUDE_MODELS.OPUS
    default:
      return CLAUDE_MODELS.SONNET
  }
}

export function buildJobContext(job: JobListing, profile: UserProfile | null): string {
  let context = `## Current Job Listing
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
${job.salary ? `Salary: ${job.salary}` : ''}
Type: ${job.jobType}
Platform: ${job.platform}
Easy Apply: ${job.easyApply ? 'Yes' : 'No'}
URL: ${job.url}

### Description
${job.description || '(No description available)'}
`

  if (profile) {
    context += `
## User Profile
Name: ${profile.name}
Title: ${profile.title}
Location: ${profile.location}
Summary: ${profile.summary}
Skills: ${profile.skills.join(', ')}

### Target Preferences
Roles: ${profile.preferences.targetRoles.join(', ')}
Compensation: $${profile.preferences.targetCompensation.min}-$${profile.preferences.targetCompensation.max} (${profile.preferences.targetCompensation.type})
Work Types: ${profile.preferences.workTypes.join(', ')}
Remote: ${profile.preferences.remotePreference}
${profile.preferences.dealbreakers.length > 0 ? `Dealbreakers: ${profile.preferences.dealbreakers.join(', ')}` : ''}
${profile.preferences.priorities.length > 0 ? `Priorities: ${profile.preferences.priorities.join(', ')}` : ''}

### Experience
${profile.experience.map((e) => `- ${e.role} at ${e.company} (${e.duration})`).join('\n')}

### Education
${profile.education.map((e) => `- ${e.degree} from ${e.school} (${e.year})`).join('\n')}
`
  }

  return context
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('rate') || err.message.includes('429')
  }
  return false
}

function isTimeoutError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('timeout') || err.message.includes('ETIMEDOUT')
  }
  return false
}

export class ClaudeService {
  private clients: Map<string, Anthropic> = new Map()
  private keyIndex = 0
  private settingsRepo = new SettingsRepo()
  private userProfileRepo = new UserProfileRepo()
  private usageRepo = new ApiUsageRepo()

  private getKeys(): string[] {
    const keys = this.settingsRepo.getApiKeys()
    if (keys.length === 0) {
      throw new AuthenticationError(
        'Anthropic API key not configured. Go to Settings to add your key.'
      )
    }
    return keys
  }

  private getNextKey(): { key: string; hash: string } {
    const keys = this.getKeys()
    const key = keys[this.keyIndex % keys.length]
    return { key, hash: hashApiKey(key) }
  }

  private rotateKey(): { key: string; hash: string } | null {
    const keys = this.getKeys()
    if (keys.length <= 1) return null
    this.keyIndex = (this.keyIndex + 1) % keys.length
    const key = keys[this.keyIndex]
    return { key, hash: hashApiKey(key) }
  }

  private getClientForKey(key: string): Anthropic {
    const hash = hashApiKey(key)
    let client = this.clients.get(hash)
    if (!client) {
      client = new Anthropic({ apiKey: key })
      this.clients.set(hash, client)
    }
    return client
  }

  /** Get model failover chain. Opus tasks: [OPUS, SONNET], Sonnet tasks: [SONNET] */
  private getModelChain(task: ClaudeTask): string[] {
    const primary = selectModel(task)
    if (primary === CLAUDE_MODELS.OPUS) {
      return [CLAUDE_MODELS.OPUS, CLAUDE_MODELS.SONNET]
    }
    return [CLAUDE_MODELS.SONNET]
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS)
    const jitter = delay * 0.1 * Math.random()
    await new Promise((r) => setTimeout(r, delay + jitter))
  }

  /** Reset all cached clients (e.g., after API key change) */
  resetClient(): void {
    this.clients.clear()
    this.keyIndex = 0
  }

  getUserProfile(): UserProfile | null {
    return this.userProfileRepo.get()
  }

  /** Send a message to Claude with retry, key rotation, and model failover */
  async complete(
    task: ClaudeTask,
    systemPrompt: string,
    userMessage: string,
    maxTokens = 2048
  ): Promise<string> {
    const models = this.getModelChain(task)
    let lastError: Error | null = null

    for (const model of models) {
      for (let attempt = 0; attempt < MAX_API_RETRY_ATTEMPTS; attempt++) {
        const keyInfo = attempt === 0 ? this.getNextKey() : (this.rotateKey() ?? this.getNextKey())

        const client = this.getClientForKey(keyInfo.key)
        const start = Date.now()

        try {
          log.info(`Claude request: task=${task}, model=${model}, attempt=${attempt + 1}`)

          const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }]
          })

          const latency = Date.now() - start
          this.usageRepo.record({
            apiKeyHash: keyInfo.hash,
            model,
            task,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            latencyMs: latency,
            success: true
          })

          const textBlock = response.content.find((b) => b.type === 'text')
          return textBlock?.text ?? ''
        } catch (err) {
          const latency = Date.now() - start
          lastError = err instanceof Error ? err : new Error(String(err))

          const rateLimit = isRateLimitError(err)
          const timeout = isTimeoutError(err)
          const errorCode = rateLimit ? 'RATE_LIMITED' : timeout ? 'TIMEOUT' : 'ERROR'

          this.usageRepo.record({
            apiKeyHash: keyInfo.hash,
            model,
            task,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: latency,
            success: false,
            errorCode
          })

          if (rateLimit) {
            log.warn(`Rate limited on key ${keyInfo.hash.slice(0, 8)}, rotating`)
            continue
          }

          if (timeout) {
            log.warn(`Timeout on model=${model}, attempt=${attempt + 1}, backing off`)
            await this.backoff(attempt)
            continue
          }

          // Non-retryable error
          throw this.wrapError(err, task, model)
        }
      }

      log.warn(`Exhausted ${MAX_API_RETRY_ATTEMPTS} retries for model=${model}, trying fallback`)
    }

    throw this.wrapError(lastError, task, models[models.length - 1])
  }

  /** Send a multi-turn conversation to Claude with retry and failover */
  async chat(
    systemPrompt: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
    maxTokens = 2048
  ): Promise<string> {
    const models = this.getModelChain('chat')
    let lastError: Error | null = null

    for (const model of models) {
      for (let attempt = 0; attempt < MAX_API_RETRY_ATTEMPTS; attempt++) {
        const keyInfo = attempt === 0 ? this.getNextKey() : (this.rotateKey() ?? this.getNextKey())

        const client = this.getClientForKey(keyInfo.key)
        const start = Date.now()

        try {
          log.info(
            `Claude chat: messages=${messages.length}, model=${model}, attempt=${attempt + 1}`
          )

          const response = await client.messages.create({
            model,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages
          })

          const latency = Date.now() - start
          this.usageRepo.record({
            apiKeyHash: keyInfo.hash,
            model,
            task: 'chat',
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            latencyMs: latency,
            success: true
          })

          const textBlock = response.content.find((b) => b.type === 'text')
          return textBlock?.text ?? ''
        } catch (err) {
          const latency = Date.now() - start
          lastError = err instanceof Error ? err : new Error(String(err))

          const rateLimit = isRateLimitError(err)
          const timeout = isTimeoutError(err)
          const errorCode = rateLimit ? 'RATE_LIMITED' : timeout ? 'TIMEOUT' : 'ERROR'

          this.usageRepo.record({
            apiKeyHash: keyInfo.hash,
            model,
            task: 'chat',
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: latency,
            success: false,
            errorCode
          })

          if (rateLimit) {
            log.warn(`Rate limited on key ${keyInfo.hash.slice(0, 8)}, rotating`)
            continue
          }

          if (timeout) {
            log.warn(`Chat timeout, attempt=${attempt + 1}, backing off`)
            await this.backoff(attempt)
            continue
          }

          throw this.wrapError(err, 'chat', model)
        }
      }

      log.warn(
        `Exhausted ${MAX_API_RETRY_ATTEMPTS} retries for chat model=${model}, trying fallback`
      )
    }

    throw this.wrapError(lastError, 'chat', models[models.length - 1])
  }

  private wrapError(err: unknown, task: string, model: string): AIServiceError {
    const message = err instanceof Error ? err.message : String(err)
    const isTimeout = message.includes('timeout') || message.includes('ETIMEDOUT')
    const isRateLimit = message.includes('rate') || message.includes('429')
    const code = isTimeout ? 'AI_TIMEOUT' : isRateLimit ? 'RATE_LIMITED' : 'AI_REQUEST_ERROR'
    return new AIServiceError(message, code, { task, model })
  }

  /** Build context string for a job + user profile */
  buildContext(job: JobListing, profile?: UserProfile | null): string {
    return buildJobContext(job, profile ?? this.getUserProfile())
  }
}

// Singleton instance
let instance: ClaudeService | null = null

export function getClaudeService(): ClaudeService {
  if (!instance) {
    instance = new ClaudeService()
  }
  return instance
}
