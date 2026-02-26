import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GhlChatHandler } from '../ai/ghl-chat-handler'
import type { GhlContactsRepo } from '../db/contacts-repo'
import type { GhlOpportunitiesRepo } from '../db/opportunities-repo'
import type { GhlPipelinesRepo } from '../db/pipelines-repo'
import type { AIService } from '@openorbit/core/ai/provider-types'

function createMockContactsRepo(): GhlContactsRepo {
  return {
    list: vi.fn().mockReturnValue([
      { id: 'ct_1', name: 'John Doe', email: 'john@test.com' },
      { id: 'ct_2', name: 'Jane Smith', email: 'jane@test.com' }
    ]),
    getById: vi.fn().mockReturnValue({ id: 'ct_1', name: 'John Doe', email: 'john@test.com' })
  } as unknown as GhlContactsRepo
}

function createMockOppsRepo(): GhlOpportunitiesRepo {
  return {
    list: vi
      .fn()
      .mockReturnValue([{ id: 'opp_1', name: 'Big Deal', monetary_value: 100000, status: 'open' }])
  } as unknown as GhlOpportunitiesRepo
}

function createMockPipelinesRepo(): GhlPipelinesRepo {
  return {
    list: vi.fn().mockReturnValue([{ id: 'pipe_1', name: 'Main Pipeline', stages: '[]' }])
  } as unknown as GhlPipelinesRepo
}

describe('GhlChatHandler', () => {
  let mockAi: AIService
  let contactsRepo: GhlContactsRepo
  let oppsRepo: GhlOpportunitiesRepo
  let pipelinesRepo: GhlPipelinesRepo

  beforeEach(() => {
    contactsRepo = createMockContactsRepo()
    oppsRepo = createMockOppsRepo()
    pipelinesRepo = createMockPipelinesRepo()

    mockAi = {
      getProvider: vi.fn().mockReturnValue(null),
      chat: vi.fn().mockResolvedValue({ content: 'Here is a summary of your contacts.' })
    } as unknown as AIService
  })

  it('falls back to simple chat when no tool-calling provider', async () => {
    const handler = new GhlChatHandler(
      mockAi,
      contactsRepo,
      oppsRepo,
      pipelinesRepo,
      () => ({}) as never,
      () => 'loc_1'
    )

    const response = await handler.sendMessage('Show me my contacts')

    expect(response).toBe('Here is a summary of your contacts.')
    expect(mockAi.chat).toHaveBeenCalledTimes(1)

    // Should include data snapshot in system prompt
    const chatCall = (mockAi.chat as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(chatCall.systemPrompt).toContain('CRM data')
  })

  it('uses agentic loop when provider supports tool calling', async () => {
    const mockProvider = {
      capabilities: { toolCalling: true },
      completeWithTools: vi.fn().mockResolvedValue({
        content: 'You have 2 contacts: John Doe and Jane Smith.',
        toolCalls: [],
        stopReason: 'end_turn'
      })
    }

    mockAi = {
      getProvider: vi.fn().mockReturnValue(mockProvider),
      chat: vi.fn()
    } as unknown as AIService

    const handler = new GhlChatHandler(
      mockAi,
      contactsRepo,
      oppsRepo,
      pipelinesRepo,
      () => ({}) as never,
      () => 'loc_1'
    )

    const response = await handler.sendMessage('How many contacts do I have?')

    expect(response).toBe('You have 2 contacts: John Doe and Jane Smith.')
    expect(mockProvider.completeWithTools).toHaveBeenCalledTimes(1)
    expect(mockAi.chat).not.toHaveBeenCalled()
  })

  it('executes tool calls in agentic loop', async () => {
    const mockProvider = {
      capabilities: { toolCalling: true },
      completeWithTools: vi
        .fn()
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc_1', name: 'list_contacts', input: { limit: 5 } }],
          stopReason: 'tool_use'
        })
        .mockResolvedValueOnce({
          content: 'Here are your contacts: John Doe and Jane Smith.',
          toolCalls: [],
          stopReason: 'end_turn'
        })
    }

    mockAi = {
      getProvider: vi.fn().mockReturnValue(mockProvider),
      chat: vi.fn()
    } as unknown as AIService

    const handler = new GhlChatHandler(
      mockAi,
      contactsRepo,
      oppsRepo,
      pipelinesRepo,
      () => ({}) as never,
      () => 'loc_1'
    )

    const response = await handler.sendMessage('List my contacts')

    expect(response).toBe('Here are your contacts: John Doe and Jane Smith.')
    expect(mockProvider.completeWithTools).toHaveBeenCalledTimes(2)
    expect(contactsRepo.list).toHaveBeenCalled()
  })

  it('limits tool calling rounds', async () => {
    const mockProvider = {
      capabilities: { toolCalling: true },
      completeWithTools: vi.fn().mockResolvedValue({
        content: '',
        toolCalls: [{ id: 'tc_loop', name: 'list_contacts', input: {} }],
        stopReason: 'tool_use'
      })
    }

    mockAi = {
      getProvider: vi.fn().mockReturnValue(mockProvider),
      chat: vi.fn()
    } as unknown as AIService

    const handler = new GhlChatHandler(
      mockAi,
      contactsRepo,
      oppsRepo,
      pipelinesRepo,
      () => ({}) as never,
      () => 'loc_1'
    )

    const response = await handler.sendMessage('infinite loop test')

    // Should hit the max rounds fallback
    expect(response).toContain('limit')
    expect(mockProvider.completeWithTools).toHaveBeenCalledTimes(5)
  })

  it('clearHistory resets conversation', async () => {
    mockAi = {
      getProvider: vi.fn().mockReturnValue(null),
      chat: vi.fn().mockResolvedValue({ content: 'Response' })
    } as unknown as AIService

    const handler = new GhlChatHandler(
      mockAi,
      contactsRepo,
      oppsRepo,
      pipelinesRepo,
      () => ({}) as never,
      () => 'loc_1'
    )

    await handler.sendMessage('Hello')
    await handler.sendMessage('Follow up')

    // History now has 4 entries: user, assistant, user, assistant
    const chatFn = mockAi.chat as ReturnType<typeof vi.fn>
    expect(chatFn).toHaveBeenCalledTimes(2)

    handler.clearHistory()
    await handler.sendMessage('Fresh start')

    expect(chatFn).toHaveBeenCalledTimes(3)
    // After clear, the messages array passed to chat should start fresh
    // (Note: since history is passed by reference, it now has user + assistant = 2)
    // But the first message should be the new one
    const thirdCallMessages = chatFn.mock.calls[2][0].messages
    expect(thirdCallMessages[0].role).toBe('user')
    expect(thirdCallMessages[0].content).toBe('Fresh start')
  })

  it('handles tool execution errors gracefully', async () => {
    const mockProvider = {
      capabilities: { toolCalling: true },
      completeWithTools: vi
        .fn()
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc_err', name: 'unknown_tool', input: {} }],
          stopReason: 'tool_use'
        })
        .mockResolvedValueOnce({
          content: 'Sorry, I encountered an error with that tool.',
          toolCalls: [],
          stopReason: 'end_turn'
        })
    }

    mockAi = {
      getProvider: vi.fn().mockReturnValue(mockProvider),
      chat: vi.fn()
    } as unknown as AIService

    const handler = new GhlChatHandler(
      mockAi,
      contactsRepo,
      oppsRepo,
      pipelinesRepo,
      () => ({}) as never,
      () => 'loc_1'
    )

    const response = await handler.sendMessage('test error')
    expect(response).toBe('Sorry, I encountered an error with that tool.')
  })
})
