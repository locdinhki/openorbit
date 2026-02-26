import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RateLimiter } from '../rate-limiter'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  beforeEach(() => {
    limiter = new RateLimiter(3, 1000) // 3 actions per 1 second
  })

  it('allows actions under the limit', () => {
    const result = limiter.check()
    expect(result.allowed).toBe(true)
    expect(result.waitMs).toBe(0)
  })

  it('blocks after reaching the limit', async () => {
    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()

    const result = limiter.check()
    expect(result.allowed).toBe(false)
    expect(result.waitMs).toBeGreaterThan(0)
  })

  it('acquire() records timestamps', async () => {
    await limiter.acquire()
    expect(limiter.getCount()).toBe(1)

    await limiter.acquire()
    expect(limiter.getCount()).toBe(2)
  })

  it('allows actions after window expires', async () => {
    vi.useFakeTimers()

    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()

    // Advance past the window
    vi.advanceTimersByTime(1100)

    const result = limiter.check()
    expect(result.allowed).toBe(true)

    vi.useRealTimers()
  })

  it('reset() clears all timestamps', async () => {
    await limiter.acquire()
    await limiter.acquire()
    expect(limiter.getCount()).toBe(2)

    limiter.reset()
    expect(limiter.getCount()).toBe(0)
  })

  it('sliding window drops old timestamps', async () => {
    vi.useFakeTimers()

    await limiter.acquire() // t=0
    vi.advanceTimersByTime(500)
    await limiter.acquire() // t=500
    vi.advanceTimersByTime(600)
    // t=1100 — first timestamp expired

    expect(limiter.getCount()).toBe(1) // only second timestamp remains

    vi.useRealTimers()
  })

  it('acquire() sleeps when rate limited', async () => {
    vi.useFakeTimers()

    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()

    // Start acquire — should sleep
    const acquirePromise = limiter.acquire()
    // Advance time past the window
    vi.advanceTimersByTime(1100)
    await acquirePromise

    expect(limiter.getCount()).toBe(1) // old 3 expired, new 1 recorded

    vi.useRealTimers()
  })

  it('works with different max/window configurations', () => {
    const strictLimiter = new RateLimiter(1, 5000) // 1 per 5 seconds
    const result = strictLimiter.check()
    expect(result.allowed).toBe(true)
  })
})
