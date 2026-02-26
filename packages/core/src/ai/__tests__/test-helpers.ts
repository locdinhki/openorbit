// ============================================================================
// Shared test helpers for AI provider tests
// ============================================================================

import { vi } from 'vitest'
import type {
  AIProvider,
  AIProviderCapabilities,
  AICompletionResponse,
  AIToolCall,
  AIToolResponse,
  AIStreamChunk
} from '../provider-types'

/** Create a mock AI provider with sensible defaults. Override any field. */
export function createMockProvider(overrides?: Partial<AIProvider>): AIProvider {
  return {
    id: 'mock-provider',
    displayName: 'Mock Provider',
    capabilities: {
      streaming: true,
      toolCalling: false,
      vision: false,
      models: ['mock-model-1']
    },
    complete: vi.fn().mockResolvedValue({
      content: 'mock response',
      model: 'mock-model-1',
      usage: { inputTokens: 10, outputTokens: 20 }
    }),
    chat: vi.fn().mockResolvedValue({
      content: 'mock chat response',
      model: 'mock-model-1',
      usage: { inputTokens: 15, outputTokens: 25 }
    }),
    isConfigured: vi.fn().mockReturnValue(true),
    ...overrides
  }
}

/** Create a mock provider that supports streaming. */
export function createStreamingProvider(
  id = 'streaming-provider',
  chunks: string[] = ['Hello', ' world', '!']
): AIProvider {
  return createMockProvider({
    id,
    displayName: `Streaming Provider (${id})`,
    capabilities: { streaming: true, toolCalling: false, vision: false, models: ['stream-model'] },
    stream: vi.fn().mockImplementation(async (_req, onChunk: (chunk: AIStreamChunk) => void) => {
      for (const text of chunks) {
        onChunk({ delta: text, done: false })
      }
      const fullContent = chunks.join('')
      onChunk({ delta: '', done: true, model: 'stream-model', usage: { inputTokens: 5, outputTokens: chunks.length } })
      return { content: fullContent, model: 'stream-model', usage: { inputTokens: 5, outputTokens: chunks.length } }
    })
  })
}

/** Create a mock provider that supports tool calling. */
export function createToolProvider(
  id = 'tool-provider',
  toolCalls: AIToolCall[] = [{ id: 'call_001', name: 'get_job', input: { jobId: 'job-123' } }]
): AIProvider {
  return createMockProvider({
    id,
    displayName: `Tool Provider (${id})`,
    capabilities: { streaming: true, toolCalling: true, vision: false, models: ['tool-model'] },
    completeWithTools: vi.fn().mockResolvedValue({
      content: '',
      model: 'tool-model',
      usage: { inputTokens: 50, outputTokens: 100 },
      toolCalls,
      stopReason: 'tool_use'
    } satisfies AIToolResponse)
  })
}

/** Wrap a string into an AICompletionResponse. */
export function mockResponse(content: string, model = 'test-model'): AICompletionResponse {
  return { content, model, usage: { inputTokens: 0, outputTokens: 0 } }
}

/** Create a tool response (either tool_use or end_turn). */
export function mockToolResponse(
  toolCalls: AIToolCall[],
  stopReason: 'tool_use' | 'end_turn' = 'tool_use',
  content = ''
): AIToolResponse {
  return {
    content,
    model: 'tool-model',
    usage: { inputTokens: 50, outputTokens: 100 },
    toolCalls,
    stopReason
  }
}
