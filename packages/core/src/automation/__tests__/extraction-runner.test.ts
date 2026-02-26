/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { ExtractionRunner } from '../extraction-runner'
import { PlatformError } from '../../errors'

// --- Mocks ---

vi.mock('../../platforms/linkedin/linkedin-adapter', () => ({
  LinkedInAdapter: class {
    platform = 'linkedin'
    isAuthenticated = vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('../../platforms/indeed/indeed-adapter', () => ({
  IndeedAdapter: class {
    platform = 'indeed'
    isAuthenticated = vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('../../platforms/upwork/upwork-adapter', () => ({
  UpworkAdapter: class {
    platform = 'upwork'
    isAuthenticated = vi.fn().mockResolvedValue(true)
  }
}))

vi.mock('../../db/jobs-repo', () => ({
  JobsRepo: class {
    exists = vi.fn().mockReturnValue(false)
    insert = vi.fn().mockReturnValue({ id: 'j1', title: 'Job', company: 'Co' })
    list = vi.fn().mockReturnValue([])
  }
}))

vi.mock('../../db/profiles-repo', () => ({
  ProfilesRepo: class {
    getById = vi.fn().mockReturnValue(null)
    listEnabled = vi.fn().mockReturnValue([])
  }
}))

vi.mock('../../db/applications-repo', () => ({
  ApplicationsRepo: class {
    listApproved = vi.fn().mockReturnValue([])
  }
}))

vi.mock('../human-behavior', () => ({
  HumanBehavior: class {
    delay = vi.fn().mockResolvedValue(undefined)
    betweenListings = vi.fn().mockResolvedValue(undefined)
    betweenApplications = vi.fn().mockResolvedValue(undefined)
    occasionalIdle = vi.fn().mockResolvedValue(undefined)
    static MAX_EXTRACTIONS_PER_SESSION = 75
  }
}))

vi.mock('../session-manager', () => ({
  SessionManager: class {
    getPage = vi.fn().mockResolvedValue({})
  }
}))

vi.mock('../rate-limiter', () => ({
  RateLimiter: class {
    acquire = vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('../circuit-breaker', () => ({
  CircuitBreaker: class {
    execute = vi.fn((fn: () => any) => fn())
  },
  CircuitOpenError: class extends Error {
    constructor() {
      super('Circuit open')
    }
  }
}))

vi.mock('../../ai/job-analyzer', () => ({
  JobAnalyzer: class {
    analyze = vi.fn().mockResolvedValue({})
  }
}))

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../core-notifier', () => ({
  getCoreNotifier: () => null
}))

vi.mock('../core-events', () => {
  const mockEmit = vi.fn()
  return {
    getCoreEventBus: () => ({
      emit: mockEmit,
      on: vi.fn(),
      off: vi.fn()
    })
  }
})

function mockSessionManager(): any {
  return {
    getPage: vi.fn().mockResolvedValue({})
  }
}

describe('ExtractionRunner', () => {
  describe('getAdapter dispatch', () => {
    it('creates a LinkedInAdapter for linkedin platform', () => {
      const runner = new ExtractionRunner(mockSessionManager())
      // Access the private getAdapter via any
      const adapter = (runner as any).getAdapter('linkedin')
      expect(adapter.platform).toBe('linkedin')
    })

    it('creates an IndeedAdapter for indeed platform', () => {
      const runner = new ExtractionRunner(mockSessionManager())
      const adapter = (runner as any).getAdapter('indeed')
      expect(adapter.platform).toBe('indeed')
    })

    it('creates an UpworkAdapter for upwork platform', () => {
      const runner = new ExtractionRunner(mockSessionManager())
      const adapter = (runner as any).getAdapter('upwork')
      expect(adapter.platform).toBe('upwork')
    })

    it('throws PlatformError for unsupported platform', () => {
      const runner = new ExtractionRunner(mockSessionManager())
      expect(() => (runner as any).getAdapter('glassdoor')).toThrow(PlatformError)
      expect(() => (runner as any).getAdapter('glassdoor')).toThrow('Unsupported platform')
    })
  })

  describe('initial state', () => {
    it('starts with idle status', () => {
      const runner = new ExtractionRunner(mockSessionManager())
      const status = runner.getStatus()
      expect(status.state).toBe('idle')
      expect(status.jobsExtracted).toBe(0)
    })

    it('isRunning returns false initially', () => {
      const runner = new ExtractionRunner(mockSessionManager())
      expect(runner.isRunning()).toBe(false)
    })
  })
})
