import { describe, it, expect } from 'vitest'
import { IPC } from '../ipc-channels'

describe('IPC Channels', () => {
  it('all channel values are unique strings', () => {
    const values = Object.values(IPC)

    for (const value of values) {
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate channel values', () => {
    const values = Object.values(IPC)
    const uniqueValues = new Set(values)

    expect(uniqueValues.size).toBe(values.length)
  })

  it('has expected number of channels', () => {
    const values = Object.values(IPC)
    // 5 session + 2 browser + 3 screencast + 3 settings + 4 update + 1 notification + 1 config + 1 rpc + 3 shell + 6 ai + 10 schedule + 5 skill + 6 skill-catalog = 50
    expect(values).toHaveLength(50)
  })

  it('all channels follow namespace:action format', () => {
    const values = Object.values(IPC)

    for (const value of values) {
      expect(value).toMatch(/^[a-z-]+:[a-z-]+$/)
    }
  })
})
