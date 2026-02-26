import { describe, it, expect } from 'vitest'
import { EXT_GHL_IPC } from '../ipc-channels'

describe('ext-ghl IPC Channels', () => {
  const channels = Object.values(EXT_GHL_IPC)

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

  it('all channels are prefixed with ext-ghl:', () => {
    for (const ch of channels) {
      expect(ch.startsWith('ext-ghl:')).toBe(true)
    }
  })

  // 3 settings + 6 contacts + 1 pipelines + 7 opps + 4 convs + 2 cals + 2 chat + 2 arv + 1 custom-fields + 2 push = 30
  it('has expected number of channels (30)', () => {
    expect(channels).toHaveLength(30)
  })
})
