import { MemoryRepo, type MemoryFact, type MemoryCategory } from '../db/memory-repo'
import { createLogger } from '../utils/logger'

const log = createLogger('MemoryExtractor')

export interface ExtractionResult {
  cleanedResponse: string
  savedFacts: MemoryFact[]
}

const MEMORY_TAG_REGEX = /<memory\s+category="([^"]+)">([\s\S]*?)<\/memory>/g
const VALID_CATEGORIES = new Set<string>(['preference', 'company', 'pattern', 'answer'])

/**
 * Parse <memory> tags from an AI response, save valid facts, and strip all tags.
 *
 * Tags with invalid categories are stripped but not saved.
 * Tags with empty content are stripped but not saved.
 * Returns the cleaned response and any saved facts.
 */
export function extractAndSaveMemories(
  response: string,
  memoryRepo: MemoryRepo
): ExtractionResult {
  const savedFacts: MemoryFact[] = []

  for (const match of response.matchAll(MEMORY_TAG_REGEX)) {
    const [, category, content] = match
    const trimmed = content.trim()

    if (!trimmed) continue

    if (!VALID_CATEGORIES.has(category)) {
      log.warn(`Invalid memory category "${category}", skipping`)
      continue
    }

    try {
      const fact = memoryRepo.addFact(category as MemoryCategory, trimmed, 'chat', 0.8)
      savedFacts.push(fact)
    } catch (err) {
      log.error('Failed to save memory fact', err)
    }
  }

  const cleanedResponse = response.replace(MEMORY_TAG_REGEX, '').replace(/\s{2,}/g, ' ').trim()

  if (savedFacts.length > 0) {
    log.info(`Extracted ${savedFacts.length} memory fact(s) from chat response`)
  }

  return { cleanedResponse, savedFacts }
}
