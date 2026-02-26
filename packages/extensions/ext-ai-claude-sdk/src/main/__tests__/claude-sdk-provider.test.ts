// ============================================================================
// Tests for ClaudeSdkProvider
//
// Mocks the Agent SDK's query() to verify AIProvider interface mapping.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AIStreamChunk } from '@openorbit/core/ai/provider-types'

// Mock the Agent SDK
const mockQueryGenerator = vi.fn()

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn((_params: unknown) => {
    const messages = mockQueryGenerator()
    return (async function* () {
      for (const msg of messages) {
        yield msg
      }
    })()
  })
}))

// Must import after mock setup
const { ClaudeSdkProvider } = await import('../claude-sdk-provider')

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}

describe('ClaudeSdkProvider', () => {
  let provider: InstanceType<typeof ClaudeSdkProvider>

  beforeEach(() => {
    vi.clearAllMocks()
    provider = new ClaudeSdkProvider(mockLog as never)
  })

  // -------------------------------------------------------------------------
  // Provider metadata
  // -------------------------------------------------------------------------

  describe('metadata', () => {
    it('has correct id and displayName', () => {
      expect(provider.id).toBe('claude-sdk')
      expect(provider.displayName).toBe('Claude (Max Plan)')
    })

    it('reports correct capabilities', () => {
      expect(provider.capabilities).toEqual({
        streaming: true,
        toolCalling: true,
        vision: false,
        models: ['haiku', 'sonnet', 'opus']
      })
    })
  })

  // -------------------------------------------------------------------------
  // complete()
  // -------------------------------------------------------------------------

  describe('complete()', () => {
    it('returns AICompletionResponse from successful query', async () => {
      mockQueryGenerator.mockReturnValue([
        {
          type: 'result',
          subtype: 'success',
          result: 'Hello from Claude SDK',
          usage: { input_tokens: 10, output_tokens: 20 },
          modelUsage: { 'claude-sonnet-4-5-20250929': { inputTokens: 10, outputTokens: 20 } },
          duration_ms: 500,
          duration_api_ms: 400,
          is_error: false,
          num_turns: 1,
          total_cost_usd: 0,
          permission_denials: []
        }
      ])

      const result = await provider.complete({
        systemPrompt: 'You are a helpful assistant.',
        userMessage: 'Hello',
        tier: 'standard',
        task: 'test'
      })

      expect(result.content).toBe('Hello from Claude SDK')
      expect(result.model).toBe('claude-sonnet-4-5-20250929')
      expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 20 })
    })

    it('maps tier to correct model', async () => {
      const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk')

      mockQueryGenerator.mockReturnValue([
        {
          type: 'result',
          subtype: 'success',
          result: 'response',
          usage: { input_tokens: 0, output_tokens: 0 },
          modelUsage: {},
          duration_ms: 100,
          duration_api_ms: 80,
          is_error: false,
          num_turns: 1,
          total_cost_usd: 0,
          permission_denials: []
        }
      ])

      await provider.complete({
        systemPrompt: 'test',
        userMessage: 'test',
        tier: 'fast',
        task: 'test'
      })

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ model: 'haiku' })
        })
      )

      await provider.complete({
        systemPrompt: 'test',
        userMessage: 'test',
        tier: 'premium',
        task: 'test'
      })

      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({ model: 'opus' })
        })
      )
    })

    it('throws AIServiceError on query failure', async () => {
      mockQueryGenerator.mockReturnValue([
        {
          type: 'result',
          subtype: 'error_during_execution',
          errors: ['Authentication failed'],
          usage: { input_tokens: 0, output_tokens: 0 },
          modelUsage: {},
          duration_ms: 100,
          duration_api_ms: 0,
          is_error: true,
          num_turns: 0,
          total_cost_usd: 0,
          permission_denials: []
        }
      ])

      await expect(
        provider.complete({
          systemPrompt: 'test',
          userMessage: 'test'
        })
      ).rejects.toThrow('Authentication failed')
    })

    it('defaults to standard tier and 1 maxTurn', async () => {
      const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk')

      mockQueryGenerator.mockReturnValue([
        {
          type: 'result',
          subtype: 'success',
          result: 'ok',
          usage: { input_tokens: 0, output_tokens: 0 },
          modelUsage: {},
          duration_ms: 100,
          duration_api_ms: 80,
          is_error: false,
          num_turns: 1,
          total_cost_usd: 0,
          permission_denials: []
        }
      ])

      await provider.complete({ systemPrompt: 'test', userMessage: 'test' })

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            model: 'sonnet',
            maxTurns: 1,
            permissionMode: 'plan'
          })
        })
      )
    })
  })

  // -------------------------------------------------------------------------
  // chat()
  // -------------------------------------------------------------------------

  describe('chat()', () => {
    it('formats messages into a single prompt', async () => {
      const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk')

      mockQueryGenerator.mockReturnValue([
        {
          type: 'result',
          subtype: 'success',
          result: 'Chat response',
          usage: { input_tokens: 30, output_tokens: 40 },
          modelUsage: { 'claude-sonnet-4-5-20250929': {} },
          duration_ms: 500,
          duration_api_ms: 400,
          is_error: false,
          num_turns: 1,
          total_cost_usd: 0,
          permission_denials: []
        }
      ])

      const result = await provider.chat({
        systemPrompt: 'You are helpful.',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' }
        ],
        tier: 'standard'
      })

      expect(result.content).toBe('Chat response')

      // Verify the prompt includes formatted messages
      const callArgs = (mockQuery as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]
      expect(callArgs.prompt).toContain('[User]\nHello')
      expect(callArgs.prompt).toContain('[Assistant]\nHi there!')
      expect(callArgs.prompt).toContain('[User]\nHow are you?')
    })
  })

  // -------------------------------------------------------------------------
  // stream()
  // -------------------------------------------------------------------------

  describe('stream()', () => {
    it('emits chunks and returns complete response', async () => {
      mockQueryGenerator.mockReturnValue([
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' }
          },
          parent_tool_use_id: null,
          uuid: 'test-uuid',
          session_id: 'test-session'
        },
        {
          type: 'stream_event',
          event: {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' world' }
          },
          parent_tool_use_id: null,
          uuid: 'test-uuid',
          session_id: 'test-session'
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'Hello world',
          usage: { input_tokens: 5, output_tokens: 10 },
          modelUsage: { 'claude-sonnet-4-5-20250929': {} },
          duration_ms: 300,
          duration_api_ms: 250,
          is_error: false,
          num_turns: 1,
          total_cost_usd: 0,
          permission_denials: []
        }
      ])

      const chunks: AIStreamChunk[] = []
      const result = await provider.stream({ systemPrompt: 'test', userMessage: 'test' }, (chunk) =>
        chunks.push(chunk)
      )

      // Intermediate chunks
      expect(chunks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ delta: 'Hello', done: false }),
          expect.objectContaining({ delta: ' world', done: false })
        ])
      )

      // Final chunk
      const finalChunk = chunks[chunks.length - 1]
      expect(finalChunk.done).toBe(true)
      expect(finalChunk.model).toBe('claude-sonnet-4-5-20250929')

      // Full response
      expect(result.content).toBe('Hello world')
      expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 10 })
    })
  })

  // -------------------------------------------------------------------------
  // completeWithTools()
  // -------------------------------------------------------------------------

  describe('completeWithTools()', () => {
    it('extracts tool calls from assistant message', async () => {
      mockQueryGenerator.mockReturnValue([
        {
          type: 'assistant',
          message: {
            content: [
              { type: 'text', text: 'Let me check that for you.' },
              {
                type: 'tool_use',
                id: 'call_001',
                name: 'list_jobs',
                input: { status: 'new' }
              }
            ],
            stop_reason: 'tool_use'
          },
          parent_tool_use_id: null,
          uuid: 'test-uuid',
          session_id: 'test-session'
        },
        {
          type: 'result',
          subtype: 'success',
          result: 'Let me check that for you.',
          usage: { input_tokens: 50, output_tokens: 100 },
          modelUsage: { 'claude-sonnet-4-5-20250929': {} },
          duration_ms: 500,
          duration_api_ms: 400,
          is_error: false,
          num_turns: 1,
          total_cost_usd: 0,
          permission_denials: []
        }
      ])

      const result = await provider.completeWithTools({
        systemPrompt: 'You are an assistant.',
        userMessage: 'Show me new jobs',
        tools: [
          {
            name: 'list_jobs',
            description: 'List jobs',
            inputSchema: {
              type: 'object',
              properties: { status: { type: 'string' } }
            }
          }
        ]
      })

      expect(result.toolCalls).toHaveLength(1)
      expect(result.toolCalls[0]).toEqual({
        id: 'call_001',
        name: 'list_jobs',
        input: { status: 'new' }
      })
      expect(result.stopReason).toBe('tool_use')
      expect(result.content).toBe('Let me check that for you.')
    })
  })

  // -------------------------------------------------------------------------
  // CLAUDECODE env stripping
  // -------------------------------------------------------------------------

  describe('env handling', () => {
    it('strips CLAUDECODE env var from query options', async () => {
      const { query: mockQuery } = await import('@anthropic-ai/claude-agent-sdk')
      const originalEnv = process.env.CLAUDECODE
      process.env.CLAUDECODE = '1'

      mockQueryGenerator.mockReturnValue([
        {
          type: 'result',
          subtype: 'success',
          result: 'ok',
          usage: { input_tokens: 0, output_tokens: 0 },
          modelUsage: {},
          duration_ms: 100,
          duration_api_ms: 80,
          is_error: false,
          num_turns: 1,
          total_cost_usd: 0,
          permission_denials: []
        }
      ])

      await provider.complete({ systemPrompt: 'test', userMessage: 'test' })

      const callArgs = (mockQuery as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]
      expect(callArgs.options.env).not.toHaveProperty('CLAUDECODE')

      // Restore
      if (originalEnv !== undefined) {
        process.env.CLAUDECODE = originalEnv
      } else {
        delete process.env.CLAUDECODE
      }
    })
  })

  // -------------------------------------------------------------------------
  // Integration with AIProviderRegistry
  // -------------------------------------------------------------------------

  describe('registry integration', () => {
    it('registers with AIProviderRegistry and routes requests', async () => {
      const { AIProviderRegistry } = await import('@openorbit/core/ai/provider-registry')

      mockQueryGenerator.mockReturnValue([
        {
          type: 'result',
          subtype: 'success',
          result: 'SDK response',
          usage: { input_tokens: 5, output_tokens: 10 },
          modelUsage: {},
          duration_ms: 100,
          duration_api_ms: 80,
          is_error: false,
          num_turns: 1,
          total_cost_usd: 0,
          permission_denials: []
        }
      ])

      const registry = new AIProviderRegistry()
      const service = registry.toService()

      service.registerProvider(provider)

      const result = await service.complete({
        systemPrompt: 'test',
        userMessage: 'test'
      })

      expect(result.content).toBe('SDK response')
    })
  })
})
