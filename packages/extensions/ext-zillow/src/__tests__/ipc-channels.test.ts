import { describe, it, expect } from 'vitest'
import { EXT_ZILLOW_IPC } from '../ipc-channels'

describe('ext-zillow IPC Channels', () => {
  const channels = Object.values(EXT_ZILLOW_IPC)

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

  it('all channels are prefixed with ext-zillow:', () => {
    for (const ch of channels) {
      expect(ch.startsWith('ext-zillow:')).toBe(true)
    }
  })

  // 2 lookup + 3 cache + 1 push = 6
  it('has expected number of channels (6)', () => {
    expect(channels).toHaveLength(6)
  })
})
