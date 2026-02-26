import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractMessage } from '../webhook-server'

const mockLog = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

// ---------------------------------------------------------------------------
// extractMessage() — unit tests for payload parsing
// ---------------------------------------------------------------------------

describe('extractMessage', () => {
  function makePayload(overrides?: Record<string, any>) {
    return {
      type: 'new-message',
      data: {
        guid: 'msg-123',
        text: 'Hello!',
        handle: { address: '+15551234567' },
        chats: [{ guid: 'iMessage;-;+15551234567', chatIdentifier: '+15551234567' }],
        isFromMe: false,
        isGroup: false,
        ...overrides
      }
    }
  }

  it('extracts handle, chatGuid, and text from valid payload', () => {
    const result = extractMessage(makePayload())
    expect(result).toEqual({
      handle: '+15551234567',
      chatGuid: 'iMessage;-;+15551234567',
      text: 'Hello!'
    })
  })

  it('returns null for isFromMe messages', () => {
    const result = extractMessage(makePayload({ isFromMe: true }))
    expect(result).toBeNull()
  })

  it('returns null for group messages', () => {
    const result = extractMessage(makePayload({ isGroup: true }))
    expect(result).toBeNull()
  })

  it('returns null for empty text', () => {
    const result = extractMessage(makePayload({ text: '' }))
    expect(result).toBeNull()
  })

  it('returns null for whitespace-only text', () => {
    const result = extractMessage(makePayload({ text: '   ' }))
    expect(result).toBeNull()
  })

  it('returns null when handle is missing', () => {
    const result = extractMessage(makePayload({ handle: null }))
    expect(result).toBeNull()
  })

  it('returns null when chats array is empty', () => {
    const result = extractMessage(makePayload({ chats: [] }))
    expect(result).toBeNull()
  })

  it('returns null when data is missing', () => {
    expect(extractMessage({})).toBeNull()
    expect(extractMessage(null)).toBeNull()
    expect(extractMessage(undefined)).toBeNull()
  })

  it('trims text content', () => {
    const result = extractMessage(makePayload({ text: '  /jobs  ' }))
    expect(result?.text).toBe('/jobs')
  })

  it('handles email handles', () => {
    const result = extractMessage(
      makePayload({
        handle: { address: 'user@icloud.com' },
        chats: [{ guid: 'iMessage;-;user@icloud.com' }]
      })
    )
    expect(result?.handle).toBe('user@icloud.com')
  })
})
