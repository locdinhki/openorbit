import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CircuitBreaker, CircuitOpenError } from '../circuit-breaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    breaker = new CircuitBreaker(3, 1000) // 3 failures, 1s reset timeout
  })

  it('starts in closed state', () => {
    expect(breaker.getState()).toBe('closed')
  })

  it('executes successfully in closed state', async () => {
    const result = await breaker.execute(async () => 42)
    expect(result).toBe(42)
    expect(breaker.getState()).toBe('closed')
  })

  it('opens after reaching failure threshold', async () => {
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const fail = () =>
      breaker.execute(async () => {
        throw new Error('fail')
      })

    await expect(fail()).rejects.toThrow('fail')
    expect(breaker.getState()).toBe('closed')

    await expect(fail()).rejects.toThrow('fail')
    expect(breaker.getState()).toBe('closed')

    await expect(fail()).rejects.toThrow('fail')
    expect(breaker.getState()).toBe('open')
  })

  it('rejects immediately when open', async () => {
    // Force open by failing 3 times
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        /* expected */
      }
    }

    await expect(breaker.execute(async () => 'should not run')).rejects.toThrow(CircuitOpenError)
  })

  it('transitions to half-open after reset timeout', async () => {
    vi.useFakeTimers()

    // Force open
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        /* expected */
      }
    }
    expect(breaker.getState()).toBe('open')

    // Advance past reset timeout
    vi.advanceTimersByTime(1100)

    // Next execute should transition to half-open and allow the call
    const result = await breaker.execute(async () => 'recovered')
    expect(result).toBe('recovered')
    expect(breaker.getState()).toBe('closed')

    vi.useRealTimers()
  })

  it('re-opens if half-open test fails', async () => {
    vi.useFakeTimers()

    // Force open
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        /* expected */
      }
    }

    // Advance past reset timeout
    vi.advanceTimersByTime(1100)

    // Fail the half-open test
    await expect(
      breaker.execute(async () => {
        throw new Error('still failing')
      })
    ).rejects.toThrow('still failing')

    expect(breaker.getState()).toBe('open')

    vi.useRealTimers()
  })

  it('resets failure count on success', async () => {
    // Fail twice (under threshold)
    try {
      await breaker.execute(async () => {
        throw new Error('fail')
      })
    } catch {
      /* expected */
    }
    try {
      await breaker.execute(async () => {
        throw new Error('fail')
      })
    } catch {
      /* expected */
    }

    // Succeed — resets the counter
    await breaker.execute(async () => 'ok')
    expect(breaker.getState()).toBe('closed')

    // Fail twice more — should still be under threshold
    try {
      await breaker.execute(async () => {
        throw new Error('fail')
      })
    } catch {
      /* expected */
    }
    try {
      await breaker.execute(async () => {
        throw new Error('fail')
      })
    } catch {
      /* expected */
    }
    expect(breaker.getState()).toBe('closed')
  })

  it('reset() returns to closed state', async () => {
    // Force open
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('fail')
        })
      } catch {
        /* expected */
      }
    }
    expect(breaker.getState()).toBe('open')

    breaker.reset()
    expect(breaker.getState()).toBe('closed')

    // Should work normally again
    const result = await breaker.execute(async () => 'back to normal')
    expect(result).toBe('back to normal')
  })
})
