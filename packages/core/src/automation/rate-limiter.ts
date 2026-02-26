import { createLogger } from '../utils/logger'

const log = createLogger('RateLimiter')

export class RateLimiter {
  private timestamps: number[] = []

  constructor(
    private maxActions: number,
    private windowMs: number = 60_000
  ) {}

  /**
   * Check if an action is allowed right now.
   * Returns { allowed, waitMs } — if not allowed, waitMs is how long to sleep.
   */
  check(): { allowed: boolean; waitMs: number } {
    this.pruneOldTimestamps()

    if (this.timestamps.length < this.maxActions) {
      return { allowed: true, waitMs: 0 }
    }

    // Oldest timestamp in the window — must wait until it expires
    const oldest = this.timestamps[0]
    const waitMs = oldest + this.windowMs - Date.now()
    return { allowed: false, waitMs: Math.max(0, waitMs) }
  }

  /**
   * Acquire a slot. If the rate limit would be exceeded, sleeps until a slot opens.
   * Records the action timestamp after acquiring.
   */
  async acquire(): Promise<void> {
    const { allowed, waitMs } = this.check()

    if (!allowed) {
      log.debug(`Rate limit reached, waiting ${waitMs}ms`)
      await new Promise((resolve) => setTimeout(resolve, waitMs))
      // Re-prune after sleeping
      this.pruneOldTimestamps()
    }

    this.timestamps.push(Date.now())
  }

  /** Reset the rate limiter, clearing all recorded timestamps. */
  reset(): void {
    this.timestamps = []
  }

  /** Get the number of actions in the current window. */
  getCount(): number {
    this.pruneOldTimestamps()
    return this.timestamps.length
  }

  private pruneOldTimestamps(): void {
    const cutoff = Date.now() - this.windowMs
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift()
    }
  }
}
