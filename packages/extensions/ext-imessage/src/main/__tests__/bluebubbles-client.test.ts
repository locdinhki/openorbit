import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BlueBubblesClient, chunkMessage } from '../bluebubbles-client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const mockLog = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

function makeOkResponse(body: unknown = {}): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body))
  } as unknown as Response
}

function makeErrorResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    headers: new Headers(),
    text: () => Promise.resolve(text)
  } as unknown as Response
}

describe('BlueBubblesClient', () => {
  let client: BlueBubblesClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new BlueBubblesClient(
      { serverUrl: 'http://localhost:1234', password: 'test-pass' },
      mockLog
    )
  })

  describe('ping', () => {
    it('returns true when server is reachable', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse({ message: 'pong' }))

      const result = await client.ping()
      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1234/api/v1/ping?password=test-pass',
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('returns false when server is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const result = await client.ping()
      expect(result).toBe(false)
    })
  })

  describe('sendMessage', () => {
    it('sends a text message with correct params', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse())

      await client.sendMessage('iMessage;-;+15551234567', 'Hello!')
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1234/api/v1/message/text?password=test-pass',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            chatGuid: 'iMessage;-;+15551234567',
            message: 'Hello!'
          })
        })
      )
    })

    it('chunks long messages into multiple sends', async () => {
      mockFetch.mockResolvedValue(makeOkResponse())

      const longText = 'A'.repeat(5000)
      await client.sendMessage('iMessage;-;+15551234567', longText)

      expect(mockFetch.mock.calls.length).toBeGreaterThan(1)
    })

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'Internal error'))

      await expect(client.sendMessage('iMessage;-;+15551234567', 'Hello!')).rejects.toThrow(
        'BlueBubbles API error 500: Internal error'
      )
    })
  })

  describe('sendTypingIndicator', () => {
    it('sends typing status to correct URL', async () => {
      mockFetch.mockResolvedValueOnce(makeOkResponse())

      await client.sendTypingIndicator('iMessage;-;+15551234567')
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/chat/'),
        expect.objectContaining({ method: 'PUT' })
      )
    })

    it('does not throw on failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      // Should not throw — typing indicator is non-critical
      await expect(client.sendTypingIndicator('iMessage;-;+15551234567')).resolves.toBeUndefined()
    })
  })

  describe('downloadAttachment', () => {
    it('downloads attachment by GUID', async () => {
      const audioBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03])
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'audio/caf' }),
        arrayBuffer: () => Promise.resolve(audioBytes.buffer)
      } as unknown as Response)

      const buffer = await client.downloadAttachment('att-audio-123')
      expect(Buffer.isBuffer(buffer)).toBe(true)
      expect(buffer.length).toBe(4)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/attachment/att-audio-123/download'),
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('throws on download error', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(404, 'Not found'))

      await expect(client.downloadAttachment('att-missing')).rejects.toThrow(
        'BlueBubbles download error 404'
      )
    })

    it('includes password in download URL', async () => {
      const audioBytes = new Uint8Array([0x00])
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: () => Promise.resolve(audioBytes.buffer)
      } as unknown as Response)

      await client.downloadAttachment('att-1')
      expect(mockFetch.mock.calls[0][0]).toContain('password=test-pass')
    })
  })

  describe('password auth', () => {
    it('includes password as query param on all requests', async () => {
      mockFetch.mockResolvedValue(makeOkResponse())

      await client.ping()
      await client.sendMessage('chat-1', 'hi')

      for (const call of mockFetch.mock.calls) {
        expect(call[0]).toContain('password=test-pass')
      }
    })

    it('strips trailing slash from server URL', async () => {
      const c = new BlueBubblesClient(
        { serverUrl: 'http://localhost:1234/', password: 'p' },
        mockLog
      )
      mockFetch.mockResolvedValueOnce(makeOkResponse())
      await c.ping()
      expect(mockFetch.mock.calls[0][0]).toMatch(/^http:\/\/localhost:1234\/api/)
    })
  })
})

describe('chunkMessage', () => {
  it('returns single chunk for short text', () => {
    const result = chunkMessage('Hello!', 4000)
    expect(result).toEqual(['Hello!'])
  })

  it('splits long text into multiple chunks', () => {
    const text = 'A'.repeat(5000)
    const chunks = chunkMessage(text, 4000)
    expect(chunks.length).toBe(2)
    expect(chunks[0].length).toBeLessThanOrEqual(4000)
  })

  it('splits on paragraph boundary when possible', () => {
    // Place paragraph boundary past the midpoint so the chunker uses it
    const firstPart = 'A'.repeat(2500)
    const text = firstPart + '\n\n' + 'B'.repeat(2500)
    const chunks = chunkMessage(text, 4000)
    expect(chunks[0]).toBe(firstPart)
    expect(chunks.length).toBe(2)
  })
})
