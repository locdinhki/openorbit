/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SiteHintFile, ActionStep } from '../../types'

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

const { HintBasedExecutor } = await import('../hint-executor')

function makeStep(overrides: Partial<ActionStep> = {}): ActionStep {
  return {
    intent: 'click_apply',
    hint: {
      selectors: ['.apply-btn'],
      textMatches: ['Apply Now'],
      ariaLabels: ['Apply'],
      location: 'job-detail',
      elementType: 'button'
    },
    fallbackDescription: 'Click the apply button',
    lastVerified: '2025-01-01',
    confidence: 0.9,
    failureCount: 0,
    ...overrides
  }
}

function makeHintFile(overrides: Partial<SiteHintFile> = {}): SiteHintFile {
  return {
    site: 'linkedin.com',
    lastFullScan: '2025-01-01',
    lastVerified: '2025-01-01',
    actions: {
      click_apply: {
        steps: [makeStep()]
      }
    },
    changeLog: [],
    ...overrides
  }
}

describe('HintBasedExecutor', () => {
  let executor: InstanceType<typeof HintBasedExecutor>

  beforeEach(() => {
    executor = new HintBasedExecutor()
  })

  describe('loadHints() / getHints()', () => {
    it('stores and retrieves hint files', () => {
      const hints = makeHintFile()
      executor.loadHints('linkedin.com', hints)

      expect(executor.getHints('linkedin.com')).toBe(hints)
    })

    it('returns undefined for unknown site', () => {
      expect(executor.getHints('unknown.com')).toBeUndefined()
    })
  })

  describe('findHintFile() via execute()', () => {
    it('finds by direct hostname match', async () => {
      executor.loadHints('linkedin.com', makeHintFile())

      const mockPage = createMockPage(true)
      const result = await executor.execute('click_apply', {
        site: 'linkedin.com',
        url: 'https://linkedin.com/jobs/1',
        page: mockPage
      })

      expect(result.success).toBe(true)
    })

    it('finds by partial hostname match', async () => {
      executor.loadHints('linkedin.com', makeHintFile())

      const mockPage = createMockPage(true)
      const result = await executor.execute('click_apply', {
        site: 'www.linkedin.com',
        url: 'https://www.linkedin.com/jobs/1',
        page: mockPage
      })

      expect(result.success).toBe(true)
    })

    it('returns error when no hint file found', async () => {
      const result = await executor.execute('click_apply', {
        site: 'unknown.com',
        url: 'https://unknown.com',
        page: {} as any
      })

      expect(result.success).toBe(false)
      expect(result.needsEscalation).toBe(true)
      expect(result.errorMessage).toContain('No hints for')
    })
  })

  describe('confidence threshold', () => {
    it('executes steps at 0.7 confidence', async () => {
      const hintFile = makeHintFile({
        actions: {
          click_apply: { steps: [makeStep({ confidence: 0.7 })] }
        }
      })
      executor.loadHints('linkedin.com', hintFile)

      const mockPage = createMockPage(true)
      const result = await executor.execute('click_apply', {
        site: 'linkedin.com',
        url: 'https://linkedin.com',
        page: mockPage
      })

      expect(result.success).toBe(true)
    })

    it('rejects steps below 0.7 confidence', async () => {
      const hintFile = makeHintFile({
        actions: {
          click_apply: { steps: [makeStep({ confidence: 0.69 })] }
        }
      })
      executor.loadHints('linkedin.com', hintFile)

      const result = await executor.execute('click_apply', {
        site: 'linkedin.com',
        url: 'https://linkedin.com',
        page: {} as any
      })

      expect(result.success).toBe(false)
      expect(result.errorMessage).toContain('Low confidence')
    })
  })

  describe('selector fallback chain', () => {
    it('succeeds when CSS selector is visible', async () => {
      executor.loadHints('linkedin.com', makeHintFile())
      const mockPage = createMockPage(true) // CSS selector visible

      const result = await executor.execute('click_apply', {
        site: 'linkedin.com',
        url: 'https://linkedin.com',
        page: mockPage
      })

      expect(result.success).toBe(true)
      // Verify CSS locator was tried
      expect(mockPage.locator).toHaveBeenCalledWith('.apply-btn')
    })

    it('succeeds via ARIA label when CSS fails', async () => {
      executor.loadHints('linkedin.com', makeHintFile())

      const mockPage = {
        locator: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockRejectedValue(new Error('not found'))
          })
        }),
        getByLabel: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        }),
        getByText: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(false)
          })
        })
      }

      const result = await executor.execute('click_apply', {
        site: 'linkedin.com',
        url: 'https://linkedin.com',
        page: mockPage
      })

      expect(result.success).toBe(true)
      // Verify ARIA label was tried after CSS failed
      expect(mockPage.locator).toHaveBeenCalled()
      expect(mockPage.getByLabel).toHaveBeenCalledWith('Apply')
    })

    it('succeeds via text match when CSS and ARIA fail', async () => {
      executor.loadHints('linkedin.com', makeHintFile())

      const mockPage = {
        locator: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockRejectedValue(new Error('not found'))
          })
        }),
        getByLabel: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockRejectedValue(new Error('not found'))
          })
        }),
        getByText: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockResolvedValue(true)
          })
        })
      }

      const result = await executor.execute('click_apply', {
        site: 'linkedin.com',
        url: 'https://linkedin.com',
        page: mockPage
      })

      expect(result.success).toBe(true)
      // Verify text match was the last resort
      expect(mockPage.getByText).toHaveBeenCalledWith('Apply Now', { exact: false })
    })

    it('returns error when all selectors fail', async () => {
      executor.loadHints('linkedin.com', makeHintFile())

      const mockPage = {
        locator: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockRejectedValue(new Error('not found'))
          })
        }),
        getByLabel: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockRejectedValue(new Error('not found'))
          })
        }),
        getByText: vi.fn().mockReturnValue({
          first: vi.fn().mockReturnValue({
            isVisible: vi.fn().mockRejectedValue(new Error('not found'))
          })
        })
      }

      const result = await executor.execute('click_apply', {
        site: 'linkedin.com',
        url: 'https://linkedin.com',
        page: mockPage
      })

      expect(result.success).toBe(false)
      expect(result.needsEscalation).toBe(true)
    })
  })
})

function createMockPage(selectorVisible: boolean) {
  return {
    locator: vi.fn().mockReturnValue({
      first: vi.fn().mockReturnValue({
        isVisible: vi.fn().mockResolvedValue(selectorVisible)
      })
    }),
    getByLabel: vi.fn().mockReturnValue({
      first: vi.fn().mockReturnValue({
        isVisible: vi.fn().mockResolvedValue(false)
      })
    }),
    getByText: vi.fn().mockReturnValue({
      first: vi.fn().mockReturnValue({
        isVisible: vi.fn().mockResolvedValue(false)
      })
    })
  }
}
