// ============================================================================
// ext-whatsapp — WhatsApp Client Tests
// ============================================================================

import { describe, it, expect, vi } from 'vitest'

// Mock Baileys before importing client
vi.mock('@whiskeysockets/baileys', () => {
  return {
    default: vi.fn(),
    makeWASocket: vi.fn(),
    useMultiFileAuthState: vi.fn().mockResolvedValue({
      state: { creds: {}, keys: {} },
      saveCreds: vi.fn()
    }),
    DisconnectReason: { loggedOut: 401 },
    isJidUser: vi.fn((jid: string) => jid?.endsWith('@s.whatsapp.net')),
    fetchLatestBaileysVersion: vi.fn().mockResolvedValue({ version: [2, 2413, 1] })
  }
})

import { WhatsAppClient, chunkMessage } from '../whatsapp-client'

const mockLog = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

describe('WhatsAppClient', () => {
  // -------------------------------------------------------------------------
  // Authorization
  // -------------------------------------------------------------------------

  describe('authorization', () => {
    it('allows all when no numbers configured', () => {
      const client = new WhatsAppClient({ authorizedNumbers: [], dataDir: '/tmp/wa' }, mockLog)
      expect(client.isAuthorized('15551234567')).toBe(true)
      expect(client.isAuthorized('+15551234567')).toBe(true)
    })

    it('allows authorized numbers', () => {
      const client = new WhatsAppClient(
        { authorizedNumbers: ['+15551234567'], dataDir: '/tmp/wa' },
        mockLog
      )
      expect(client.isAuthorized('15551234567')).toBe(true)
      expect(client.isAuthorized('+15551234567')).toBe(true)
    })

    it('blocks unauthorized numbers', () => {
      const client = new WhatsAppClient(
        { authorizedNumbers: ['+15551234567'], dataDir: '/tmp/wa' },
        mockLog
      )
      expect(client.isAuthorized('15559999999')).toBe(false)
    })

    it('normalizes numbers with and without + prefix', () => {
      const client = new WhatsAppClient(
        { authorizedNumbers: ['15551234567'], dataDir: '/tmp/wa' },
        mockLog
      )
      expect(client.isAuthorized('+15551234567')).toBe(true)
      expect(client.isAuthorized('15551234567')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  describe('state', () => {
    it('is not running initially', () => {
      const client = new WhatsAppClient({ authorizedNumbers: [], dataDir: '/tmp/wa' }, mockLog)
      expect(client.isRunning()).toBe(false)
    })

    it('is not running after stop', () => {
      const client = new WhatsAppClient({ authorizedNumbers: [], dataDir: '/tmp/wa' }, mockLog)
      client.stop()
      expect(client.isRunning()).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Voice transcriber
  // -------------------------------------------------------------------------

  describe('voice transcriber', () => {
    it('accepts a voice transcriber', () => {
      const client = new WhatsAppClient({ authorizedNumbers: [], dataDir: '/tmp/wa' }, mockLog)
      const mockTranscriber = {
        transcribe: vi.fn(),
        isAvailable: vi.fn(),
        isEnabled: vi.fn()
      }
      client.setTranscriber(
        mockTranscriber as unknown as import('@openorbit/core/audio/voice-transcriber').VoiceTranscriber
      )
      // No assertion needed — just verify it doesn't throw
    })
  })
})

// ---------------------------------------------------------------------------
// chunkMessage — unit tests
// ---------------------------------------------------------------------------

describe('chunkMessage', () => {
  it('returns single chunk for short text', () => {
    const chunks = chunkMessage('Hello', 4000)
    expect(chunks).toEqual(['Hello'])
  })

  it('splits at paragraph boundary', () => {
    const text = 'A'.repeat(2500) + '\n\n' + 'B'.repeat(2500)
    const chunks = chunkMessage(text, 4000)
    expect(chunks.length).toBe(2)
    expect(chunks[0]).toBe('A'.repeat(2500))
    expect(chunks[1]).toBe('B'.repeat(2500))
  })

  it('hard splits when no paragraph boundary', () => {
    const text = 'A'.repeat(8000)
    const chunks = chunkMessage(text, 4000)
    expect(chunks.length).toBe(2)
    expect(chunks[0].length).toBe(4000)
    expect(chunks[1].length).toBe(4000)
  })

  it('handles exact maxLen', () => {
    const text = 'A'.repeat(4000)
    const chunks = chunkMessage(text, 4000)
    expect(chunks).toEqual([text])
  })

  it('handles empty text', () => {
    const chunks = chunkMessage('', 4000)
    expect(chunks).toEqual([''])
  })
})
