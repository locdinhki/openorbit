import { describe, it, expect } from 'vitest'
import { EXT_DB_VIEWER_IPC } from '../ipc-channels'

describe('ext-db-viewer IPC Channels', () => {
  const channels = Object.values(EXT_DB_VIEWER_IPC)

  it('all channel values are unique strings', () => {
    for (const ch of channels) {
      expect(typeof ch).toBe('string')
      expect(ch.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate channel values', () => {
    const unique = new Set(channels)
    expect(unique.size).toBe(channels.length)
  })

  it('all channels follow namespace:action format', () => {
    for (const ch of channels) {
      expect(ch).toMatch(/^[a-z-]+:[a-z-]+$/)
    }
  })

  it('all channels are prefixed with ext-db-viewer:', () => {
    for (const ch of channels) {
      expect(ch.startsWith('ext-db-viewer:')).toBe(true)
    }
  })

  it('has expected number of channels (13)', () => {
    expect(channels).toHaveLength(13)
  })
})
