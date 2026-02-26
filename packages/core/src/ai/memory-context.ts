import { MemoryRepo, type MemoryFact } from '../db/memory-repo'
import { createLogger } from '../utils/logger'

const log = createLogger('MemoryContext')

function formatFacts(facts: MemoryFact[]): string {
  return facts.map((f) => `- [${f.category}] ${f.content}`).join('\n')
}

export class MemoryContextBuilder {
  private memoryRepo: MemoryRepo

  constructor(memoryRepo?: MemoryRepo) {
    this.memoryRepo = memoryRepo ?? new MemoryRepo()
  }

  /**
   * Build memory context for job analysis.
   * Includes: user preferences, known company facts, application patterns.
   */
  buildJobAnalysisContext(jobTitle: string, company: string): string {
    const sections: string[] = []

    // User preferences (role preferences, dealbreakers, etc.)
    const preferences = this.memoryRepo.getByCategory('preference', 10)
    if (preferences.length > 0) {
      sections.push(`### User Preferences\n${formatFacts(preferences)}`)
    }

    // Company knowledge
    const companyFacts = this.memoryRepo.search(company, {
      category: 'company',
      limit: 5
    })
    if (companyFacts.length > 0) {
      sections.push(
        `### Known Facts About ${company}\n${formatFacts(companyFacts.map((r) => r.fact))}`
      )
    }

    // Relevant patterns (e.g., "user rejected all DevOps roles")
    const patterns = this.memoryRepo.search(jobTitle, {
      category: 'pattern',
      limit: 5
    })
    if (patterns.length > 0) {
      sections.push(`### Relevant Patterns\n${formatFacts(patterns.map((r) => r.fact))}`)
    }

    if (sections.length === 0) return ''

    const context = `## Memory Context\n${sections.join('\n\n')}`
    log.info('Built job analysis memory context', {
      preferences: preferences.length,
      companyFacts: companyFacts.length,
      patterns: patterns.length
    })
    return context
  }

  /**
   * Build memory context for answer generation.
   * Includes: past successful answers and relevant preferences.
   */
  buildAnswerContext(question: string, company: string): string {
    const sections: string[] = []

    // Past answers to similar questions
    const pastAnswers = this.memoryRepo.search(question, {
      category: 'answer',
      limit: 5
    })
    if (pastAnswers.length > 0) {
      sections.push(
        `### Past Answers to Similar Questions\n${formatFacts(pastAnswers.map((r) => r.fact))}`
      )
    }

    // Company-specific knowledge
    const companyFacts = this.memoryRepo.search(company, {
      category: 'company',
      limit: 3
    })
    if (companyFacts.length > 0) {
      sections.push(
        `### Known Facts About ${company}\n${formatFacts(companyFacts.map((r) => r.fact))}`
      )
    }

    // Relevant preferences
    const preferences = this.memoryRepo.search(question, {
      category: 'preference',
      limit: 3
    })
    if (preferences.length > 0) {
      sections.push(`### Relevant Preferences\n${formatFacts(preferences.map((r) => r.fact))}`)
    }

    if (sections.length === 0) return ''

    const context = `## Memory Context\n${sections.join('\n\n')}`
    log.info('Built answer memory context', {
      pastAnswers: pastAnswers.length,
      companyFacts: companyFacts.length,
      preferences: preferences.length
    })
    return context
  }

  /**
   * Build memory context for chat conversations.
   * Includes: recent user preferences and facts relevant to the current message.
   */
  buildChatContext(userMessage: string): string {
    const sections: string[] = []

    // Recent user preferences
    const preferences = this.memoryRepo.getByCategory('preference', 10)
    if (preferences.length > 0) {
      sections.push(`### User Preferences\n${formatFacts(preferences)}`)
    }

    // Facts relevant to the current message (all categories)
    const relevant = this.memoryRepo.search(userMessage, { limit: 5 })
    if (relevant.length > 0) {
      // Deduplicate: exclude facts already shown in preferences
      const prefIds = new Set(preferences.map((p) => p.id))
      const newFacts = relevant.filter((r) => !prefIds.has(r.fact.id))
      if (newFacts.length > 0) {
        sections.push(`### Relevant Context\n${formatFacts(newFacts.map((r) => r.fact))}`)
      }
    }

    if (sections.length === 0) return ''

    const context = `## Memory Context\n${sections.join('\n\n')}`
    log.info('Built chat memory context', {
      preferences: preferences.length,
      relevant: relevant.length
    })
    return context
  }
}
