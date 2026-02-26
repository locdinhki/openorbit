/**
 * Answer template anonymization for community contribution.
 *
 * Users can opt-in to share successful application answers (after review).
 * PII is stripped before submission: names, emails, phone numbers, URLs.
 */

export interface RawAnswer {
  question: string
  answer: string
  platform?: string
}

export interface AnonymizedTemplate {
  question: string
  answer: string
  platform?: string
}

// Patterns that identify PII in answers
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  // Phone numbers (US and international)
  { pattern: /(\+?1?[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, replacement: '[PHONE]' },
  // URLs
  { pattern: /https?:\/\/[^\s,)]+/g, replacement: '[URL]' },
  // LinkedIn URLs (catch before generic URL)
  { pattern: /linkedin\.com\/in\/[a-zA-Z0-9\-_%]+/g, replacement: '[LINKEDIN]' },
  // Common full-name patterns (Firstname Lastname at start of sentence or quoted)
  // This is heuristic — we flag for user review rather than auto-remove
]

// Words that commonly indicate PII — flag for user review
const PII_FLAG_WORDS = ['my name is', 'i am', "i'm", 'call me', 'reach me at']

/**
 * Anonymize a single answer.
 * Applies pattern-based PII removal. Returns the cleaned answer plus
 * a list of flagged phrases for user review.
 */
export function anonymizeAnswer(raw: RawAnswer): {
  template: AnonymizedTemplate
  flags: string[]
} {
  let answer = raw.answer
  const flags: string[] = []

  // Apply pattern replacements
  for (const { pattern, replacement } of PII_PATTERNS) {
    answer = answer.replace(pattern, replacement)
  }

  // Flag for user review (don't auto-remove — too aggressive)
  for (const word of PII_FLAG_WORDS) {
    if (answer.toLowerCase().includes(word)) {
      flags.push(`Contains "${word}" — review for personal information`)
    }
  }

  return {
    template: {
      question: raw.question,
      answer,
      platform: raw.platform
    },
    flags
  }
}

/**
 * Anonymize a batch of answers. Returns templates with their review flags.
 */
export function anonymizeAnswers(answers: RawAnswer[]): Array<{
  template: AnonymizedTemplate
  flags: string[]
}> {
  return answers.map(anonymizeAnswer)
}

/**
 * Format anonymized templates as a diff-style preview for user review.
 */
export function formatContributionPreview(
  results: Array<{ template: AnonymizedTemplate; flags: string[] }>
): string {
  const lines: string[] = ['=== Contribution Preview ===', '']

  for (const { template, flags } of results) {
    lines.push(`Q: ${template.question}`)
    lines.push(`A: ${template.answer}`)
    if (template.platform) lines.push(`Platform: ${template.platform}`)
    if (flags.length > 0) {
      lines.push(`⚠ Review needed:`)
      for (const flag of flags) lines.push(`  - ${flag}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generate a GitHub Gist body for template contribution.
 * The user pastes this into a new Gist or PR.
 */
export function buildContributionPayload(
  templates: AnonymizedTemplate[],
  metadata: { contributor?: string; note?: string } = {}
): string {
  return JSON.stringify(
    {
      version: '1',
      contributor: metadata.contributor ?? 'anonymous',
      note: metadata.note ?? '',
      submittedAt: new Date().toISOString(),
      templates
    },
    null,
    2
  )
}
