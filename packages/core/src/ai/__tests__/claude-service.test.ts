/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  }
}))

const mockGetApiKeys = vi.fn()
const mockGetApiKey = vi.fn()
vi.mock('../../db/settings-repo', () => ({
  SettingsRepo: class {
    getApiKeys = mockGetApiKeys
    getApiKey = mockGetApiKey
  }
}))

const mockProfileGet = vi.fn().mockReturnValue(null)
vi.mock('../../db/user-profile-repo', () => ({
  UserProfileRepo: class {
    get = mockProfileGet
  }
}))

const mockRecord = vi.fn()
vi.mock('../../db/api-usage-repo', () => ({
  ApiUsageRepo: class {
    record = mockRecord
  }
}))

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

const { ClaudeService, hashApiKey } = await import('../claude-service')

// --- Helpers ---

function makeResponse(text: string, inputTokens = 100, outputTokens = 50): any {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens }
  }
}

function setupKeys(keys: string[]): void {
  mockGetApiKeys.mockReturnValue(keys)
}

describe('hashApiKey()', () => {
  it('returns a 16-char hex string', () => {
    const hash = hashApiKey('sk-ant-test-key-123')
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('returns same hash for same key', () => {
    expect(hashApiKey('my-key')).toBe(hashApiKey('my-key'))
  })

  it('returns different hashes for different keys', () => {
    expect(hashApiKey('key-a')).not.toBe(hashApiKey('key-b'))
  })
})

describe('ClaudeService', () => {
  let service: InstanceType<typeof ClaudeService>

  beforeEach(() => {
    service = new ClaudeService()
    vi.clearAllMocks()
    setupKeys(['sk-key-1'])
  })

  describe('complete()', () => {
    it('returns text from successful response', async () => {
      mockCreate.mockResolvedValue(makeResponse('Hello world'))

      const result = await service.complete('score_job', 'system', 'user msg')
      expect(result).toBe('Hello world')
    })

    it('passes correct params to Anthropic', async () => {
      mockCreate.mockResolvedValue(makeResponse('ok'))

      await service.complete('score_job', 'system prompt', 'user message', 4096)

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: 'system prompt',
        messages: [{ role: 'user', content: 'user message' }]
      })
    })

    it('uses Opus for cover_letter task', async () => {
      mockCreate.mockResolvedValue(makeResponse('cover letter'))

      await service.complete('cover_letter', 'system', 'msg')

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'claude-opus-4-6' }))
    })

    it('records usage on success', async () => {
      mockCreate.mockResolvedValue(makeResponse('ok', 150, 80))

      await service.complete('score_job', 'sys', 'msg')

      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-5-20250929',
          task: 'score_job',
          inputTokens: 150,
          outputTokens: 80,
          success: true
        })
      )
    })

    it('records usage on failure', async () => {
      mockCreate.mockRejectedValue(new Error('server error'))

      await expect(service.complete('score_job', 'sys', 'msg')).rejects.toThrow()

      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: 'ERROR'
        })
      )
    })

    it('returns empty string when response has no text block', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'tool_use', id: 't1', name: 'fn', input: {} }],
        usage: { input_tokens: 10, output_tokens: 5 }
      })

      const result = await service.complete('score_job', 'sys', 'msg')
      expect(result).toBe('')
    })
  })

  describe('retry on rate limit (429)', () => {
    it('rotates key and retries on rate limit error', async () => {
      setupKeys(['sk-key-1', 'sk-key-2'])

      mockCreate
        .mockRejectedValueOnce(new Error('rate limit exceeded 429'))
        .mockResolvedValueOnce(makeResponse('success after rotate'))

      const result = await service.complete('score_job', 'sys', 'msg')
      expect(result).toBe('success after rotate')
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('records RATE_LIMITED error code', async () => {
      setupKeys(['sk-key-1', 'sk-key-2'])

      mockCreate
        .mockRejectedValueOnce(new Error('429 rate limit'))
        .mockResolvedValueOnce(makeResponse('ok'))

      await service.complete('score_job', 'sys', 'msg')

      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: 'RATE_LIMITED'
        })
      )
    })
  })

  describe('retry on timeout', () => {
    it('retries with backoff on timeout', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('Request timeout'))
        .mockResolvedValueOnce(makeResponse('recovered'))

      const result = await service.complete('score_job', 'sys', 'msg')
      expect(result).toBe('recovered')
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })

    it('retries on ETIMEDOUT', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('connect ETIMEDOUT'))
        .mockResolvedValueOnce(makeResponse('ok'))

      const result = await service.complete('score_job', 'sys', 'msg')
      expect(result).toBe('ok')
    })

    it('records TIMEOUT error code', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('timeout exceeded'))
        .mockResolvedValueOnce(makeResponse('ok'))

      await service.complete('score_job', 'sys', 'msg')

      expect(mockRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          errorCode: 'TIMEOUT'
        })
      )
    })
  })

  describe('model failover', () => {
    it('falls back from Opus to Sonnet on exhausted retries', async () => {
      setupKeys(['sk-key-1', 'sk-key-2', 'sk-key-3'])

      // cover_letter uses Opus → Sonnet chain
      // Use rate-limit errors (no backoff delay) to exhaust Opus retries
      mockCreate
        .mockRejectedValueOnce(new Error('429 rate limit'))
        .mockRejectedValueOnce(new Error('429 rate limit'))
        .mockRejectedValueOnce(new Error('429 rate limit'))
        // Now on Sonnet fallback
        .mockResolvedValueOnce(makeResponse('sonnet fallback'))

      const result = await service.complete('cover_letter', 'sys', 'msg')
      expect(result).toBe('sonnet fallback')

      // 3 Opus attempts + 1 Sonnet attempt = 4
      expect(mockCreate).toHaveBeenCalledTimes(4)

      // Last call should use Sonnet model
      const lastCall = mockCreate.mock.calls[3][0]
      expect(lastCall.model).toBe('claude-sonnet-4-5-20250929')
    })

    it('throws after exhausting all models and retries', async () => {
      setupKeys(['sk-key-1', 'sk-key-2', 'sk-key-3'])

      // Sonnet-only task (score_job): 3 rate-limit retries, then throw
      mockCreate.mockRejectedValue(new Error('429 rate limit'))

      await expect(service.complete('score_job', 'sys', 'msg')).rejects.toThrow()
      expect(mockCreate).toHaveBeenCalledTimes(3)
    })
  })

  describe('non-retryable errors', () => {
    it('throws immediately on non-retryable error', async () => {
      mockCreate.mockRejectedValue(new Error('invalid_api_key'))

      await expect(service.complete('score_job', 'sys', 'msg')).rejects.toThrow('invalid_api_key')
      expect(mockCreate).toHaveBeenCalledTimes(1)
    })
  })

  describe('no API keys configured', () => {
    it('throws AuthenticationError when no keys exist', async () => {
      mockGetApiKeys.mockReturnValue([])

      await expect(service.complete('score_job', 'sys', 'msg')).rejects.toThrow(
        'Anthropic API key not configured'
      )
    })
  })

  describe('chat()', () => {
    it('sends multi-turn messages', async () => {
      mockCreate.mockResolvedValue(makeResponse('chat response'))

      const messages = [
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there' },
        { role: 'user' as const, content: 'How are you?' }
      ]

      const result = await service.chat('system prompt', messages)
      expect(result).toBe('chat response')
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'system prompt',
          messages
        })
      )
    })

    it('retries on rate limit in chat', async () => {
      setupKeys(['sk-key-1', 'sk-key-2'])

      mockCreate
        .mockRejectedValueOnce(new Error('rate limit 429'))
        .mockResolvedValueOnce(makeResponse('ok'))

      const result = await service.chat('sys', [{ role: 'user', content: 'hi' }])
      expect(result).toBe('ok')
    })

    it('records chat task in usage', async () => {
      mockCreate.mockResolvedValue(makeResponse('ok'))

      await service.chat('sys', [{ role: 'user', content: 'hi' }])

      expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ task: 'chat' }))
    })
  })

  describe('resetClient()', () => {
    it('clears cached clients so new ones are created', async () => {
      mockCreate.mockResolvedValue(makeResponse('first'))
      await service.complete('score_job', 'sys', 'msg')

      service.resetClient()

      mockCreate.mockResolvedValue(makeResponse('second'))
      const result = await service.complete('score_job', 'sys', 'msg')
      expect(result).toBe('second')
    })
  })

  describe('buildContext()', () => {
    it('builds context string for a job', () => {
      const job = {
        title: 'React Dev',
        company: 'Acme',
        location: 'Remote',
        salary: '$100k',
        jobType: 'full-time',
        platform: 'linkedin',
        easyApply: true,
        url: 'https://example.com/job/1',
        description: 'Build React apps'
      } as any

      const ctx = service.buildContext(job)
      expect(ctx).toContain('React Dev')
      expect(ctx).toContain('Acme')
      expect(ctx).toContain('Remote')
      expect(ctx).toContain('$100k')
    })
  })
})
