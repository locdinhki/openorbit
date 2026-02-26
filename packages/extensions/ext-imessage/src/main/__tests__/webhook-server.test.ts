import { describe, it, expect } from 'vitest'
import { extractMessage } from '../webhook-server'

// ---------------------------------------------------------------------------
// extractMessage() — unit tests for payload parsing
// ---------------------------------------------------------------------------

describe('extractMessage', () => {
  function makePayload(overrides?: Record<string, unknown>): Record<string, unknown> {
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

  it('returns null for empty text without audio', () => {
    const result = extractMessage(makePayload({ text: '' }))
    expect(result).toBeNull()
  })

  it('returns null for whitespace-only text without audio', () => {
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

  // -------------------------------------------------------------------------
  // Audio attachment extraction
  // -------------------------------------------------------------------------

  describe('audio attachments', () => {
    it('extracts audio attachment GUID when no text', () => {
      const result = extractMessage(
        makePayload({
          text: '',
          attachments: [{ guid: 'att-audio-123', mimeType: 'audio/caf', filename: 'voice.caf' }]
        })
      )
      expect(result).not.toBeNull()
      expect(result?.audioAttachmentGuid).toBe('att-audio-123')
      expect(result?.text).toBe('')
    })

    it('ignores non-audio attachments', () => {
      const result = extractMessage(
        makePayload({
          text: '',
          attachments: [{ guid: 'att-img-123', mimeType: 'image/jpeg', filename: 'photo.jpg' }]
        })
      )
      expect(result).toBeNull()
    })

    it('prefers text over audio attachment', () => {
      const result = extractMessage(
        makePayload({
          text: 'Hello!',
          attachments: [{ guid: 'att-audio-123', mimeType: 'audio/caf', filename: 'voice.caf' }]
        })
      )
      expect(result?.text).toBe('Hello!')
      expect(result?.audioAttachmentGuid).toBeUndefined()
    })

    it('returns null for audio without guid', () => {
      const result = extractMessage(
        makePayload({
          text: '',
          attachments: [{ mimeType: 'audio/caf', filename: 'voice.caf' }]
        })
      )
      expect(result).toBeNull()
    })
  })
})
