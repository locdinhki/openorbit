// ============================================================================
// ext-discord — Discord Client Tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock discord.js before importing client
vi.mock('discord.js', () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      login: vi.fn().mockResolvedValue('token'),
      destroy: vi.fn(),
      user: { id: '123', tag: 'TestBot#1234' }
    })),
    GatewayIntentBits: {
      Guilds: 1,
      DirectMessages: 2,
      MessageContent: 4
    },
    Partials: { Channel: 0 },
    ChannelType: { DM: 1 },
    REST: vi.fn().mockImplementation(() => ({
      setToken: vi.fn().mockReturnThis(),
      put: vi.fn().mockResolvedValue([])
    })),
    Routes: {
      applicationCommands: vi.fn().mockReturnValue('/commands')
    },
    EmbedBuilder: vi.fn().mockImplementation(() => {
      const instance: Record<string, unknown> = {
        data: {},
        setTitle: vi.fn().mockReturnThis(),
        setColor: vi.fn().mockReturnThis(),
        setURL: vi.fn().mockReturnThis(),
        setDescription: vi.fn().mockReturnThis(),
        addFields: vi.fn().mockReturnThis(),
        toJSON: vi.fn().mockReturnValue({ title: 'test', fields: [] })
      }
      return instance
    }),
    ActionRowBuilder: vi.fn().mockImplementation(() => ({
      addComponents: vi.fn().mockReturnThis(),
      toJSON: vi.fn().mockReturnValue({ components: [] })
    })),
    ButtonBuilder: vi.fn().mockImplementation(() => ({
      setCustomId: vi.fn().mockReturnThis(),
      setLabel: vi.fn().mockReturnThis(),
      setStyle: vi.fn().mockReturnThis()
    })),
    ButtonStyle: { Success: 3, Danger: 4 },
    SlashCommandBuilder: vi.fn().mockImplementation(() => ({
      setName: vi.fn().mockReturnThis(),
      setDescription: vi.fn().mockReturnThis(),
      toJSON: vi.fn().mockReturnValue({ name: 'test', description: 'test' })
    }))
  }
})

import { DiscordClient } from '../discord-client'

const mockLog = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

describe('DiscordClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Authorization
  // -------------------------------------------------------------------------

  describe('authorization', () => {
    it('allows all when no user IDs configured', () => {
      const client = new DiscordClient({ token: 'test-token', authorizedUserIds: [] }, mockLog)
      expect(client.isAuthorized('123456789')).toBe(true)
      expect(client.isAuthorized('987654321')).toBe(true)
    })

    it('allows authorized user IDs', () => {
      const client = new DiscordClient(
        { token: 'test-token', authorizedUserIds: ['123456789'] },
        mockLog
      )
      expect(client.isAuthorized('123456789')).toBe(true)
    })

    it('blocks unauthorized user IDs', () => {
      const client = new DiscordClient(
        { token: 'test-token', authorizedUserIds: ['123456789'] },
        mockLog
      )
      expect(client.isAuthorized('987654321')).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  describe('state', () => {
    it('is not running initially', () => {
      const client = new DiscordClient({ token: 'test-token', authorizedUserIds: [] }, mockLog)
      expect(client.isRunning()).toBe(false)
    })

    it('is not running after stop', () => {
      const client = new DiscordClient({ token: 'test-token', authorizedUserIds: [] }, mockLog)
      client.stop()
      expect(client.isRunning()).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // Handler registration
  // -------------------------------------------------------------------------

  describe('handlers', () => {
    it('accepts message handler', () => {
      const client = new DiscordClient({ token: 'test-token', authorizedUserIds: [] }, mockLog)
      const handler = vi.fn()
      client.setMessageHandler(handler)
      // No assertion needed — just verify it doesn't throw
    })

    it('accepts callback handler', () => {
      const client = new DiscordClient({ token: 'test-token', authorizedUserIds: [] }, mockLog)
      const handler = vi.fn()
      client.setCallbackHandler(handler)
    })

    it('accepts slash command handler', () => {
      const client = new DiscordClient({ token: 'test-token', authorizedUserIds: [] }, mockLog)
      const handler = vi.fn()
      client.setSlashCommandHandler(handler)
    })

    it('accepts voice transcriber', () => {
      const client = new DiscordClient({ token: 'test-token', authorizedUserIds: [] }, mockLog)
      const mockTranscriber = {
        transcribe: vi.fn(),
        isAvailable: vi.fn(),
        isEnabled: vi.fn()
      }
      client.setTranscriber(
        mockTranscriber as unknown as import('@openorbit/core/audio/voice-transcriber').VoiceTranscriber
      )
    })
  })
})
