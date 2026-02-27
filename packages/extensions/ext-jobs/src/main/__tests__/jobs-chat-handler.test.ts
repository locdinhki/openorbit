import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JobsChatHandler } from '../ai/jobs-chat-handler'
import type { ProfilesRepo } from '../db/profiles-repo'
import type { JobsRepo } from '../db/jobs-repo'
import type { ActionLogRepo } from '../db/action-log-repo'
import type { AnswersRepo } from '../db/answers-repo'
import type { AIService } from '@openorbit/core/ai/provider-types'
import type { UserProfileRepo } from '@openorbit/core/db/user-profile-repo'

function createMockJobsRepo(): JobsRepo {
  return {
    list: vi.fn().mockReturnValue([
      { id: 'j_1', title: 'Senior SWE', company: 'Acme', status: 'new', matchScore: 85 },
      { id: 'j_2', title: 'Staff Eng', company: 'Mega Corp', status: 'reviewed', matchScore: 72 }
    ]),
    getById: vi.fn().mockReturnValue({
      id: 'j_1',
      title: 'Senior SWE',
      company: 'Acme',
      status: 'new',
      matchScore: 85,
      description: 'Great role'
    }),
    count: vi.fn().mockReturnValue(5)
  } as unknown as JobsRepo
}

function createMockProfilesRepo(): ProfilesRepo {
  return {
    list: vi.fn().mockReturnValue([
      { id: 'p_1', name: 'Remote SWE', platform: 'linkedin', enabled: true },
      { id: 'p_2', name: 'Contract Work', platform: 'upwork', enabled: false }
    ]),
    getById: vi.fn().mockReturnValue({
      id: 'p_1',
      name: 'Remote SWE',
      platform: 'linkedin',
      enabled: true
    })
  } as unknown as ProfilesRepo
}

function createMockActionLogRepo(): ActionLogRepo {
  return {
    getRecent: vi.fn().mockReturnValue([])
  } as unknown as ActionLogRepo
}

function createMockAnswersRepo(): AnswersRepo {
  return {
    list: vi
      .fn()
      .mockReturnValue([
        { id: 'a_1', questionPattern: 'salary', answer: '150k-200k', usageCount: 3 }
      ]),
    findMatch: vi.fn().mockReturnValue(null)
  } as unknown as AnswersRepo
}

function createMockUserProfileRepo(): UserProfileRepo {
  return {
    get: vi.fn().mockReturnValue(null),
    save: vi.fn()
  } as unknown as UserProfileRepo
}

describe('JobsChatHandler', () => {
  let mockAi: AIService
  let jobsRepo: JobsRepo
  let profilesRepo: ProfilesRepo
  let actionLogRepo: ActionLogRepo
  let answersRepo: AnswersRepo
  let userProfileRepo: UserProfileRepo

  beforeEach(() => {
    jobsRepo = createMockJobsRepo()
    profilesRepo = createMockProfilesRepo()
    actionLogRepo = createMockActionLogRepo()
    answersRepo = createMockAnswersRepo()
    userProfileRepo = createMockUserProfileRepo()

    mockAi = {
      getProvider: vi.fn().mockReturnValue(null),
      chat: vi.fn().mockResolvedValue({ content: 'Here is a summary of your jobs.' })
    } as unknown as AIService
  })

  it('falls back to simple chat when no tool-calling provider', async () => {
    const handler = new JobsChatHandler(
      mockAi,
      jobsRepo,
      profilesRepo,
      actionLogRepo,
      answersRepo,
      null,
      userProfileRepo
    )

    const response = await handler.sendMessage('Show me my jobs')

    expect(response).toBe('Here is a summary of your jobs.')
    expect(mockAi.chat).toHaveBeenCalledTimes(1)

    // Should include data snapshot in system prompt
    const chatCall = (mockAi.chat as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(chatCall.systemPrompt).toContain('data snapshot')
  })

  it('uses agentic loop when provider supports tool calling', async () => {
    const mockProvider = {
      capabilities: { toolCalling: true },
      completeWithTools: vi.fn().mockResolvedValue({
        content: 'You have 2 jobs: Senior SWE and Staff Eng.',
        toolCalls: [],
        stopReason: 'end_turn'
      })
    }

    mockAi = {
      getProvider: vi.fn().mockReturnValue(mockProvider),
      chat: vi.fn()
    } as unknown as AIService

    const handler = new JobsChatHandler(
      mockAi,
      jobsRepo,
      profilesRepo,
      actionLogRepo,
      answersRepo,
      null,
      userProfileRepo
    )

    const response = await handler.sendMessage('How many jobs do I have?')

    expect(response).toBe('You have 2 jobs: Senior SWE and Staff Eng.')
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
          toolCalls: [{ id: 'tc_1', name: 'list_jobs', input: { status: 'new', limit: 5 } }],
          stopReason: 'tool_use'
        })
        .mockResolvedValueOnce({
          content: 'Here are your new jobs: Senior SWE at Acme and Staff Eng at Mega Corp.',
          toolCalls: [],
          stopReason: 'end_turn'
        })
    }

    mockAi = {
      getProvider: vi.fn().mockReturnValue(mockProvider),
      chat: vi.fn()
    } as unknown as AIService

    const handler = new JobsChatHandler(
      mockAi,
      jobsRepo,
      profilesRepo,
      actionLogRepo,
      answersRepo,
      null,
      userProfileRepo
    )

    const response = await handler.sendMessage('List my new jobs')

    expect(response).toBe('Here are your new jobs: Senior SWE at Acme and Staff Eng at Mega Corp.')
    expect(mockProvider.completeWithTools).toHaveBeenCalledTimes(2)
    expect(jobsRepo.list).toHaveBeenCalled()
  })

  it('limits tool calling rounds', async () => {
    const mockProvider = {
      capabilities: { toolCalling: true },
      completeWithTools: vi.fn().mockResolvedValue({
        content: '',
        toolCalls: [{ id: 'tc_loop', name: 'list_jobs', input: {} }],
        stopReason: 'tool_use'
      })
    }

    mockAi = {
      getProvider: vi.fn().mockReturnValue(mockProvider),
      chat: vi.fn()
    } as unknown as AIService

    const handler = new JobsChatHandler(
      mockAi,
      jobsRepo,
      profilesRepo,
      actionLogRepo,
      answersRepo,
      null,
      userProfileRepo
    )

    const response = await handler.sendMessage('infinite loop test')

    expect(response).toContain('limit')
    expect(mockProvider.completeWithTools).toHaveBeenCalledTimes(5)
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

    const handler = new JobsChatHandler(
      mockAi,
      jobsRepo,
      profilesRepo,
      actionLogRepo,
      answersRepo,
      null,
      userProfileRepo
    )

    const response = await handler.sendMessage('test error')
    expect(response).toBe('Sorry, I encountered an error with that tool.')
  })

  it('clearHistory resets conversation', async () => {
    mockAi = {
      getProvider: vi.fn().mockReturnValue(null),
      chat: vi.fn().mockResolvedValue({ content: 'Response' })
    } as unknown as AIService

    const handler = new JobsChatHandler(
      mockAi,
      jobsRepo,
      profilesRepo,
      actionLogRepo,
      answersRepo,
      null,
      userProfileRepo
    )

    await handler.sendMessage('Hello')
    await handler.sendMessage('Follow up')

    const chatFn = mockAi.chat as ReturnType<typeof vi.fn>
    expect(chatFn).toHaveBeenCalledTimes(2)

    handler.clearHistory()
    await handler.sendMessage('Fresh start')

    expect(chatFn).toHaveBeenCalledTimes(3)
    const thirdCallMessages = chatFn.mock.calls[2][0].messages
    expect(thirdCallMessages[0].role).toBe('user')
    expect(thirdCallMessages[0].content).toBe('Fresh start')
  })

  it('dispatches get_job tool correctly', async () => {
    const mockProvider = {
      capabilities: { toolCalling: true },
      completeWithTools: vi
        .fn()
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [{ id: 'tc_gj', name: 'get_job', input: { jobId: 'j_1' } }],
          stopReason: 'tool_use'
        })
        .mockResolvedValueOnce({
          content: 'The Senior SWE role at Acme has a score of 85.',
          toolCalls: [],
          stopReason: 'end_turn'
        })
    }

    mockAi = {
      getProvider: vi.fn().mockReturnValue(mockProvider),
      chat: vi.fn()
    } as unknown as AIService

    const handler = new JobsChatHandler(
      mockAi,
      jobsRepo,
      profilesRepo,
      actionLogRepo,
      answersRepo,
      null,
      userProfileRepo
    )

    await handler.sendMessage('Tell me about job j_1')

    expect(jobsRepo.getById).toHaveBeenCalledWith('j_1')
  })

  it('dispatches list_profiles and list_answer_templates tools', async () => {
    const mockProvider = {
      capabilities: { toolCalling: true },
      completeWithTools: vi
        .fn()
        .mockResolvedValueOnce({
          content: '',
          toolCalls: [
            { id: 'tc_lp', name: 'list_profiles', input: {} },
            { id: 'tc_la', name: 'list_answer_templates', input: { platform: 'linkedin' } }
          ],
          stopReason: 'tool_use'
        })
        .mockResolvedValueOnce({
          content: 'You have 2 profiles and 1 answer template.',
          toolCalls: [],
          stopReason: 'end_turn'
        })
    }

    mockAi = {
      getProvider: vi.fn().mockReturnValue(mockProvider),
      chat: vi.fn()
    } as unknown as AIService

    const handler = new JobsChatHandler(
      mockAi,
      jobsRepo,
      profilesRepo,
      actionLogRepo,
      answersRepo,
      null,
      userProfileRepo
    )

    await handler.sendMessage('Show my profiles and answers')

    expect(profilesRepo.list).toHaveBeenCalled()
    expect(answersRepo.list).toHaveBeenCalledWith('linkedin')
  })
})
