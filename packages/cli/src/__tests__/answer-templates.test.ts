import { describe, it, expect } from 'vitest'
import {
  anonymizeAnswer,
  anonymizeAnswers,
  formatContributionPreview,
  buildContributionPayload
} from '../answer-templates'

describe('anonymizeAnswer()', () => {
  it('strips email addresses', () => {
    const { template } = anonymizeAnswer({
      question: 'What is your email?',
      answer: 'My email is john.doe@example.com, reach me there'
    })
    expect(template.answer).not.toContain('john.doe@example.com')
    expect(template.answer).toContain('[EMAIL]')
  })

  it('strips phone numbers', () => {
    const { template } = anonymizeAnswer({
      question: 'Phone?',
      answer: 'Call me at 555-867-5309 anytime'
    })
    expect(template.answer).not.toContain('555-867-5309')
    expect(template.answer).toContain('[PHONE]')
  })

  it('strips URLs', () => {
    const { template } = anonymizeAnswer({
      question: 'Portfolio?',
      answer: 'See https://myportfolio.com/projects for examples'
    })
    expect(template.answer).not.toContain('https://myportfolio.com/projects')
    expect(template.answer).toContain('[URL]')
  })

  it('preserves question text unchanged', () => {
    const { template } = anonymizeAnswer({
      question: 'Why do you want this job?',
      answer: 'Because I am passionate about engineering'
    })
    expect(template.question).toBe('Why do you want this job?')
  })

  it('preserves platform field', () => {
    const { template } = anonymizeAnswer({
      question: 'Q',
      answer: 'A',
      platform: 'linkedin'
    })
    expect(template.platform).toBe('linkedin')
  })

  it('flags answers containing "my name is"', () => {
    const { flags } = anonymizeAnswer({
      question: 'Introduce yourself',
      answer: 'My name is John and I have 5 years of experience'
    })
    expect(flags.length).toBeGreaterThan(0)
    expect(flags[0]).toContain('my name is')
  })

  it('returns empty flags for clean answers', () => {
    const { flags } = anonymizeAnswer({
      question: 'Years of experience?',
      answer: '5 years of software engineering experience'
    })
    expect(flags).toHaveLength(0)
  })
})

describe('anonymizeAnswers()', () => {
  it('processes a batch of answers', () => {
    const results = anonymizeAnswers([
      { question: 'Email?', answer: 'test@example.com' },
      { question: 'Phone?', answer: '555-123-4567' }
    ])
    expect(results).toHaveLength(2)
    expect(results[0].template.answer).toContain('[EMAIL]')
    expect(results[1].template.answer).toContain('[PHONE]')
  })
})

describe('formatContributionPreview()', () => {
  it('includes question and answer in output', () => {
    const preview = formatContributionPreview([
      {
        template: { question: 'Why this role?', answer: 'Because of the mission' },
        flags: []
      }
    ])
    expect(preview).toContain('Q: Why this role?')
    expect(preview).toContain('A: Because of the mission')
  })

  it('shows review flags when present', () => {
    const preview = formatContributionPreview([
      {
        template: { question: 'Intro', answer: 'My name is redacted' },
        flags: ['Contains "my name is" — review for personal information']
      }
    ])
    expect(preview).toContain('⚠ Review needed')
    expect(preview).toContain('my name is')
  })
})

describe('buildContributionPayload()', () => {
  it('produces valid JSON with expected fields', () => {
    const payload = buildContributionPayload(
      [{ question: 'Why?', answer: 'Because' }],
      { note: 'test contribution' }
    )
    const parsed = JSON.parse(payload)
    expect(parsed.version).toBe('1')
    expect(parsed.note).toBe('test contribution')
    expect(parsed.templates).toHaveLength(1)
    expect(parsed.submittedAt).toBeTruthy()
  })

  it('defaults contributor to "anonymous"', () => {
    const payload = JSON.parse(buildContributionPayload([]))
    expect(payload.contributor).toBe('anonymous')
  })
})
