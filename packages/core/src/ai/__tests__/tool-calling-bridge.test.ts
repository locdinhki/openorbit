// ============================================================================
// Tool calling bridge tests
//
// Tests the tool calling flow across extension boundaries:
//   1. Consumer defines AIToolDefinition[] (e.g. get_job_details)
//   2. Routes through registry to a tool-capable provider
//   3. Provider returns AIToolResponse with toolCalls[]
//   4. Consumer executes tools, builds AIToolResult[]
//   5. Consumer sends follow-up with results → provider returns final answer
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  AIService,
  AIToolDefinition,
  AIToolRequest,
  AIToolResponse,
  AIToolCall,
  AIToolResult
} from '../provider-types'
import { createMockProvider, createToolProvider, mockToolResponse } from './test-helpers'

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

const { AIProviderRegistry } = await import('../provider-registry')

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const jobDetailsTool: AIToolDefinition = {
  name: 'get_job_details',
  description: 'Fetch job listing details by ID',
  inputSchema: {
    type: 'object',
    properties: {
      jobId: { type: 'string', description: 'The job ID to fetch' }
    },
    required: ['jobId']
  }
}

const searchJobsTool: AIToolDefinition = {
  name: 'search_jobs',
  description: 'Search for jobs by keyword',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', description: 'Max results' }
    },
    required: ['query']
  }
}

describe('Tool calling bridge', () => {
  let registry: InstanceType<typeof AIProviderRegistry>
  let service: AIService

  beforeEach(() => {
    registry = new AIProviderRegistry()
    service = registry.toService()
    vi.clearAllMocks()
  })

  // ---------------------------------------------------------------------------
  // Tool definition passthrough
  // ---------------------------------------------------------------------------

  describe('tool definition passthrough', () => {
    it('consumer sends AIToolDefinition[] and provider receives them exactly', async () => {
      const provider = createToolProvider('claude')
      service.registerProvider(provider)

      const request: AIToolRequest = {
        systemPrompt: 'You are a job search assistant.',
        userMessage: 'Find details for job-123',
        tools: [jobDetailsTool],
        tier: 'standard',
        task: 'tool_use'
      }

      const resolvedProvider = service.getProvider()!
      await resolvedProvider.completeWithTools!(request)

      expect(provider.completeWithTools).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: [
            expect.objectContaining({
              name: 'get_job_details',
              inputSchema: expect.objectContaining({ type: 'object' })
            })
          ]
        })
      )
    })

    it('multiple tool definitions are passed through correctly', async () => {
      const provider = createToolProvider('claude')
      service.registerProvider(provider)

      const request: AIToolRequest = {
        systemPrompt: 'sys',
        userMessage: 'msg',
        tools: [jobDetailsTool, searchJobsTool],
        tier: 'standard'
      }

      const resolvedProvider = service.getProvider()!
      await resolvedProvider.completeWithTools!(request)

      const calledWith = (provider.completeWithTools as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(calledWith.tools).toHaveLength(2)
      expect(calledWith.tools[0].name).toBe('get_job_details')
      expect(calledWith.tools[1].name).toBe('search_jobs')
    })
  })

  // ---------------------------------------------------------------------------
  // Tool call response parsing
  // ---------------------------------------------------------------------------

  describe('tool call response parsing', () => {
    it('provider returns toolCalls[] with tool_use stop reason', async () => {
      const provider = createToolProvider('claude', [
        { id: 'call_001', name: 'get_job_details', input: { jobId: 'job-456' } }
      ])
      service.registerProvider(provider)

      const resolvedProvider = service.getProvider()!
      const response = await resolvedProvider.completeWithTools!({
        systemPrompt: 'sys',
        userMessage: 'Get job details',
        tools: [jobDetailsTool]
      })

      expect(response.stopReason).toBe('tool_use')
      expect(response.toolCalls).toHaveLength(1)
      expect(response.toolCalls[0].name).toBe('get_job_details')
      expect(response.toolCalls[0].input).toEqual({ jobId: 'job-456' })
    })

    it('provider returns empty toolCalls with end_turn when no tools needed', async () => {
      const provider = createMockProvider({
        id: 'claude',
        capabilities: { streaming: true, toolCalling: true, vision: false, models: ['model'] },
        completeWithTools: vi.fn().mockResolvedValue(
          mockToolResponse([], 'end_turn', 'I can answer without tools.')
        )
      })
      service.registerProvider(provider)

      const resolvedProvider = service.getProvider()!
      const response = await resolvedProvider.completeWithTools!({
        systemPrompt: 'sys',
        userMessage: 'What is 2+2?',
        tools: [jobDetailsTool]
      })

      expect(response.stopReason).toBe('end_turn')
      expect(response.toolCalls).toHaveLength(0)
      expect(response.content).toBe('I can answer without tools.')
    })

    it('multiple tool calls returned in a single response', async () => {
      const provider = createToolProvider('claude', [
        { id: 'call_001', name: 'get_job_details', input: { jobId: 'job-1' } },
        { id: 'call_002', name: 'search_jobs', input: { query: 'react', limit: 5 } }
      ])
      service.registerProvider(provider)

      const resolvedProvider = service.getProvider()!
      const response = await resolvedProvider.completeWithTools!({
        systemPrompt: 'sys',
        userMessage: 'Find and detail react jobs',
        tools: [jobDetailsTool, searchJobsTool]
      })

      expect(response.toolCalls).toHaveLength(2)
      expect(response.toolCalls[0].id).toBe('call_001')
      expect(response.toolCalls[1].id).toBe('call_002')
    })
  })

  // ---------------------------------------------------------------------------
  // Tool execution round-trip
  // ---------------------------------------------------------------------------

  describe('tool execution round-trip', () => {
    it('consumer builds AIToolResult from tool call output', () => {
      const toolCall: AIToolCall = {
        id: 'call_001',
        name: 'get_job_details',
        input: { jobId: 'job-123' }
      }

      // Consumer executes the tool (simulated)
      const toolOutput = { title: 'React Developer', company: 'Acme', salary: '$150k' }

      const toolResult: AIToolResult = {
        toolCallId: toolCall.id,
        content: JSON.stringify(toolOutput),
        isError: false
      }

      expect(toolResult.toolCallId).toBe('call_001')
      expect(JSON.parse(toolResult.content)).toEqual(toolOutput)
      expect(toolResult.isError).toBe(false)
    })

    it('consumer can mark tool result as error', () => {
      const toolResult: AIToolResult = {
        toolCallId: 'call_001',
        content: 'Job not found: job-999',
        isError: true
      }

      expect(toolResult.isError).toBe(true)
      expect(toolResult.content).toContain('Job not found')
    })

    it('full loop: request → tool_use → execute → result → final response', async () => {
      const mockCompleteWithTools = vi.fn()
      const provider = createMockProvider({
        id: 'claude',
        capabilities: { streaming: true, toolCalling: true, vision: false, models: ['sonnet'] },
        completeWithTools: mockCompleteWithTools
      })
      service.registerProvider(provider)

      // Step 1: Consumer sends request with tools
      mockCompleteWithTools.mockResolvedValueOnce(
        mockToolResponse(
          [{ id: 'call_001', name: 'get_job_details', input: { jobId: 'job-123' } }],
          'tool_use'
        )
      )

      const resolvedProvider = service.getProvider()!
      const firstResponse = await resolvedProvider.completeWithTools!({
        systemPrompt: 'You are a job assistant with tools.',
        userMessage: 'Tell me about job-123',
        tools: [jobDetailsTool],
        tier: 'standard',
        task: 'tool_use'
      })

      expect(firstResponse.stopReason).toBe('tool_use')
      expect(firstResponse.toolCalls).toHaveLength(1)

      // Step 2: Consumer executes the tool
      const toolCall = firstResponse.toolCalls[0]
      expect(toolCall.name).toBe('get_job_details')
      expect(toolCall.input).toEqual({ jobId: 'job-123' })

      const toolResult: AIToolResult = {
        toolCallId: toolCall.id,
        content: JSON.stringify({ title: 'React Dev', company: 'Acme', location: 'Remote' })
      }

      // Step 3: Consumer sends follow-up with tool result
      // In practice, this would include tool results in a chat-style follow-up
      mockCompleteWithTools.mockResolvedValueOnce(
        mockToolResponse(
          [],
          'end_turn',
          'Job-123 is a React Developer position at Acme, based remotely.'
        )
      )

      const finalResponse = await resolvedProvider.completeWithTools!({
        systemPrompt: 'You are a job assistant with tools.',
        userMessage: `Tool result for ${toolResult.toolCallId}: ${toolResult.content}`,
        tools: [jobDetailsTool],
        tier: 'standard',
        task: 'tool_use'
      })

      // Step 4: Verify final response
      expect(finalResponse.stopReason).toBe('end_turn')
      expect(finalResponse.toolCalls).toHaveLength(0)
      expect(finalResponse.content).toContain('React Developer')
      expect(finalResponse.content).toContain('Acme')
    })
  })

  // ---------------------------------------------------------------------------
  // Capability checking
  // ---------------------------------------------------------------------------

  describe('capability checking', () => {
    it('consumer checks capabilities.toolCalling before calling completeWithTools', () => {
      const toolProvider = createToolProvider('claude')
      const basicProvider = createMockProvider({
        id: 'basic',
        capabilities: { streaming: false, toolCalling: false, vision: false, models: ['basic'] }
      })
      service.registerProvider(toolProvider)
      service.registerProvider(basicProvider)

      const claude = service.getProvider('claude')!
      const basic = service.getProvider('basic')!

      expect(claude.capabilities.toolCalling).toBe(true)
      expect(basic.capabilities.toolCalling).toBe(false)
    })

    it('provider without toolCalling has completeWithTools undefined', () => {
      const provider = createMockProvider({
        id: 'basic',
        capabilities: { streaming: false, toolCalling: false, vision: false, models: ['basic'] }
        // completeWithTools not set → undefined
      })
      service.registerProvider(provider)

      const resolved = service.getProvider('basic')!
      expect(resolved.completeWithTools).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // Routing through registry for tool calls
  // ---------------------------------------------------------------------------

  describe('routing through registry for tool calls', () => {
    it('consumer gets provider via service.getProvider() and calls completeWithTools', async () => {
      const provider = createToolProvider('claude')
      service.registerProvider(provider)

      // This is the pattern consumers must use since completeWithTools
      // is on AIProvider, not AIService
      const resolved = service.getProvider()
      expect(resolved).toBeDefined()
      expect(resolved!.completeWithTools).toBeTypeOf('function')

      const response = await resolved!.completeWithTools!({
        systemPrompt: 'sys',
        userMessage: 'use tools',
        tools: [jobDetailsTool]
      })

      expect(response.stopReason).toBe('tool_use')
      expect(provider.completeWithTools).toHaveBeenCalled()
    })

    it('consumer gets specific provider by ID for tool calling', async () => {
      const claude = createToolProvider('claude')
      const openai = createToolProvider('openai')
      service.registerProvider(claude)
      service.registerProvider(openai)

      // Consumer specifically wants openai for tool calling
      const resolved = service.getProvider('openai')!
      await resolved.completeWithTools!({
        systemPrompt: 'sys',
        userMessage: 'use tools',
        tools: [jobDetailsTool]
      })

      expect(openai.completeWithTools).toHaveBeenCalled()
      expect(claude.completeWithTools).not.toHaveBeenCalled()
    })
  })
})
