// ============================================================================
// OpenOrbit — AI Service Backward Compatibility
//
// Wraps the legacy ClaudeService singleton as an AIService for callers that
// haven't yet been migrated to receive AIService via dependency injection.
// This will be removed once all callers thread AIService through their
// constructors.
// ============================================================================

import type {
  AIService,
  AICompletionRequest,
  AICompletionResponse,
  AIChatRequest
} from './provider-types'
import type { ClaudeTask } from '../types'
import { getClaudeService } from './claude-service'

/**
 * Creates an AIService facade backed by the legacy getClaudeService() singleton.
 * Used as a fallback when AIService is not injected via constructor.
 */
export function createLegacyAIService(): AIService {
  return {
    registerProvider: () => {
      throw new Error('Cannot register providers on legacy AI service')
    },
    getProvider: () => undefined,
    listProviders: () => [],
    setDefault: () => {
      throw new Error('Cannot set default on legacy AI service')
    },
    async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
      const claude = getClaudeService()
      const task = (request.task ?? 'chat') as ClaudeTask
      const content = await claude.complete(
        task,
        request.systemPrompt,
        request.userMessage,
        request.maxTokens ?? 2048
      )
      return { content, model: 'unknown', usage: { inputTokens: 0, outputTokens: 0 } }
    },
    async chat(request: AIChatRequest): Promise<AICompletionResponse> {
      const claude = getClaudeService()
      const content = await claude.chat(
        request.systemPrompt,
        request.messages,
        request.maxTokens ?? 2048
      )
      return { content, model: 'unknown', usage: { inputTokens: 0, outputTokens: 0 } }
    }
  }
}
