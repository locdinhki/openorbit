import { createLogger } from '../utils/logger'

const log = createLogger('CircuitBreaker')

export class CircuitOpenError extends Error {
  constructor(message = 'Circuit breaker is open — requests are blocked') {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

type CircuitState = 'closed' | 'open' | 'half-open'

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureTime = 0

  constructor(
    private failureThreshold: number = 3,
    private resetTimeoutMs: number = 60_000
  ) {}

  /**
   * Wrap an async operation with circuit breaker protection.
   * - closed: execute normally, track failures
   * - open: reject immediately with CircuitOpenError
   * - half-open: allow one test request; success → closed, failure → open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if enough time has passed to try half-open
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.state = 'half-open'
        log.info('Circuit breaker transitioning to half-open')
      } else {
        throw new CircuitOpenError()
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    }
  }

  getState(): CircuitState {
    return this.state
  }

  /** Force reset to closed state. */
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.lastFailureTime = 0
    log.info('Circuit breaker reset to closed')
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      log.info('Circuit breaker recovered — closing')
    }
    this.failureCount = 0
    this.state = 'closed'
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'half-open') {
      this.state = 'open'
      log.warn('Circuit breaker half-open test failed — reopening')
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'open'
      log.warn(`Circuit breaker opened after ${this.failureCount} consecutive failures`)
    }
  }
}
