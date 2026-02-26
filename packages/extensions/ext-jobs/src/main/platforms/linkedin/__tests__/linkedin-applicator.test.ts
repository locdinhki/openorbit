/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LinkedInApplicator } from '../linkedin-applicator'

// --- Mock dependencies as classes ---

const mockDelay = vi.fn().mockResolvedValue(undefined)
const mockHumanClick = vi.fn().mockResolvedValue(undefined)
const mockHumanType = vi.fn().mockResolvedValue(undefined)
const mockWaitForAnySelector = vi.fn().mockResolvedValue(null)
const mockGetVisibleText = vi.fn().mockResolvedValue('')
const mockFindMatch = vi.fn().mockReturnValue(null)
const mockRecordUsage = vi.fn()
const mockAnswersInsert = vi.fn()
const mockGenerateAnswer = vi.fn().mockResolvedValue({
  answer: 'Generated answer',
  confidence: 0.9,
  needsReview: false
})

vi.mock('@openorbit/core/automation/human-behavior', () => ({
  HumanBehavior: class MockHumanBehavior {
    delay = mockDelay
    humanClick = mockHumanClick
    humanType = mockHumanType
  }
}))

vi.mock('@openorbit/core/automation/page-reader', () => ({
  PageReader: class MockPageReader {
    waitForAnySelector = mockWaitForAnySelector
    getVisibleText = mockGetVisibleText
  }
}))

vi.mock('../../../db/answers-repo', () => ({
  AnswersRepo: class MockAnswersRepo {
    findMatch = mockFindMatch
    recordUsage = mockRecordUsage
    insert = mockAnswersInsert
  }
}))

vi.mock('@openorbit/core/ai/answer-generator', () => ({
  AnswerGenerator: class MockAnswerGenerator {
    generateAnswer = mockGenerateAnswer
  }
}))

vi.mock('@openorbit/core/utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

function createMockPage(): Record<string, unknown> {
  return {
    $$: vi.fn().mockResolvedValue([]),
    $: vi.fn().mockResolvedValue(null),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    check: vi.fn().mockResolvedValue(undefined),
    selectOption: vi.fn().mockResolvedValue(undefined),
    keyboard: {
      press: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined)
    },
    locator: vi.fn().mockReturnValue({
      first: vi.fn().mockReturnValue({
        isVisible: vi.fn().mockResolvedValue(false),
        innerText: vi.fn().mockResolvedValue(''),
        boundingBox: vi.fn().mockResolvedValue(null)
      })
    }),
    mouse: {
      click: vi.fn().mockResolvedValue(undefined)
    },
    evaluate: vi.fn().mockResolvedValue(''),
    url: vi.fn().mockReturnValue('https://www.linkedin.com/jobs/view/123')
  }
}

function createMockJob() {
  return {
    id: 'job-1',
    externalId: 'ext-1',
    platform: 'linkedin',
    profileId: 'profile-1',
    url: 'https://www.linkedin.com/jobs/view/123',
    title: 'Software Engineer',
    company: 'Acme Corp',
    location: 'Remote',
    jobType: 'full-time',
    description: 'Build cool stuff',
    postedDate: '2024-01-01',
    easyApply: true,
    status: 'approved' as const,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
}

describe('LinkedInApplicator', () => {
  let applicator: LinkedInApplicator

  beforeEach(() => {
    vi.clearAllMocks()
    mockWaitForAnySelector.mockResolvedValue(null)
    mockGetVisibleText.mockResolvedValue('')
    applicator = new LinkedInApplicator()
  })

  it('returns error when Easy Apply button is not found', async () => {
    const page = createMockPage()
    const job = createMockJob()

    const result = await applicator.apply(page as never, job, {}, '/resume.pdf')

    expect(result.success).toBe(false)
    expect(result.jobId).toBe('job-1')
    expect(result.errorMessage).toContain('Easy Apply button')
  })

  it('tracks progress via onProgress callback', async () => {
    const page = createMockPage()
    const job = createMockJob()
    const progressCalls: Array<{ step: number; currentAction: string }> = []

    await applicator.apply(page as never, job, {}, '/resume.pdf', (progress) =>
      progressCalls.push(progress)
    )

    expect(progressCalls.length).toBeGreaterThan(0)
    expect(progressCalls[0].step).toBe(0)
    expect(progressCalls[0].currentAction).toContain('Easy Apply')
  })

  it('returns error result on exception in modal open', async () => {
    const page = createMockPage()
    const job = createMockJob()

    let callNum = 0
    mockWaitForAnySelector.mockImplementation(async () => {
      callNum++
      if (callNum === 1) return 'button.jobs-apply-button' // Easy Apply button
      throw new Error('Unexpected error')
    })

    const fresh = new LinkedInApplicator()
    const result = await fresh.apply(page as never, job, {}, '/resume.pdf')

    expect(result.success).toBe(false)
    expect(result.errorMessage).toBeTruthy()
  })

  it('extractFormFields returns empty array for empty modal', async () => {
    const page = createMockPage()
    const fields = await applicator.extractFormFields(page as never)
    expect(fields).toEqual([])
  })

  it('findBestOption matches exact values', () => {
    const findBestOption = (applicator as any).findBestOption.bind(applicator)

    expect(findBestOption('Yes', ['Yes', 'No'])).toBe('Yes')
    expect(findBestOption('yes', ['Yes', 'No'])).toBe('Yes')
    expect(findBestOption('no', ['Yes', 'No'])).toBe('No')
  })

  it('findBestOption matches partial values', () => {
    const findBestOption = (applicator as any).findBestOption.bind(applicator)

    expect(findBestOption('5 years', ['1-3 years', '5-7 years', '8+ years'])).toBe('5-7 years')
    expect(findBestOption('bachelor', ["Bachelor's degree", "Master's degree"])).toBe(
      "Bachelor's degree"
    )
  })

  it('findBestOption returns undefined for no match', () => {
    const findBestOption = (applicator as any).findBestOption.bind(applicator)

    expect(findBestOption('xyz', ['Alpha', 'Beta'])).toBeUndefined()
  })

  it('findProvidedAnswer matches exact and fuzzy keys', () => {
    const findProvidedAnswer = (applicator as any).findProvidedAnswer.bind(applicator)

    const answers = {
      'phone number': '555-1234',
      'years of experience': '5',
      email: 'test@example.com'
    }

    expect(findProvidedAnswer('phone number', answers)).toBe('555-1234')
    expect(findProvidedAnswer('your phone number here', answers)).toBe('555-1234')
    expect(findProvidedAnswer('email', answers)).toBe('test@example.com')
    expect(findProvidedAnswer('address', answers)).toBeUndefined()
  })

  it('closeModal handles dismiss + discard flow', async () => {
    const page = createMockPage()

    mockWaitForAnySelector.mockResolvedValue('button[aria-label="Dismiss"]')

    const fresh = new LinkedInApplicator()
    await fresh.closeModal(page as never)

    expect(mockHumanClick).toHaveBeenCalled()
  })

  it('apply returns answersUsed in result', async () => {
    const page = createMockPage()
    const job = createMockJob()

    const result = await applicator.apply(page as never, job, { phone: '555-1234' }, '/resume.pdf')

    expect(result.answersUsed).toBeDefined()
    expect(typeof result.answersUsed).toBe('object')
  })

  it('apply includes jobId in result', async () => {
    const page = createMockPage()
    const job = createMockJob()

    const result = await applicator.apply(page as never, job, {}, '/resume.pdf')

    expect(result.jobId).toBe('job-1')
  })

  it('apply respects max steps limit', async () => {
    const page = createMockPage()
    const job = createMockJob()

    let callCount = 0
    mockWaitForAnySelector.mockImplementation(async (_p: unknown, selectors: string[]) => {
      callCount++
      if (callCount === 1) return 'button.jobs-apply-button'
      if (callCount === 2) return '.jobs-easy-apply-modal'
      // Submit button: never found
      if (selectors.some((s) => s.includes('Submit'))) return null
      // Review: never found
      if (selectors.some((s) => s.includes('Review'))) return null
      // Next button: always found (to keep looping)
      if (selectors.some((s) => s.includes('Continue') || s.includes('primary'))) {
        return 'button.artdeco-button--primary'
      }
      // Dismiss button for cleanup
      if (selectors.some((s) => s.includes('Dismiss'))) return 'button[aria-label="Dismiss"]'
      // Error selectors: none
      if (selectors.some((s) => s.includes('error') || s.includes('feedback'))) return null
      return null
    })

    const fresh = new LinkedInApplicator()
    const result = await fresh.apply(page as never, job, {}, '/resume.pdf')

    expect(result.success).toBe(false)
    expect(result.errorMessage).toContain('maximum steps')
  })
})
