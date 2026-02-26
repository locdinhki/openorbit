# 10.1: Inline Memory Extraction

**Effort:** Low | **Status:** Not started

## Background

The memory backend is complete (Phase 3 migration V3): `memory_facts` table with FTS5 search, `MemoryRepo` CRUD, `MemoryContextBuilder` for prompt injection. JobAnalyzer and AnswerGenerator already read from memory to improve scoring and answer generation. But the chat interfaces — `ChatHandler` (in-app) and `AIGateway` (Telegram) — don't participate. This subphase wires them in.

The approach uses **inline extraction** — the system prompt tells Claude to embed `<memory category="...">fact</memory>` tags in its response when the user reveals something memorable. We parse and strip these tags before displaying the response, then save the facts via MemoryRepo. Zero extra API calls.

## Tasks

### Memory Extractor Utility
- [ ] Create `packages/core/src/ai/memory-extractor.ts`
- [ ] `extractAndSaveMemories(response, memoryRepo)` function
- [ ] Regex-parse all `<memory category="...">content</memory>` tags
- [ ] Validate category against `MemoryCategory` type (`preference`, `company`, `pattern`, `answer`)
- [ ] Save valid facts via `memoryRepo.addFact(category, content, 'chat', 0.8)`
- [ ] Strip all `<memory>` tags from response (including invalid ones)
- [ ] Return `{ cleanedResponse, savedFacts }` tuple
- [ ] Skip empty content, log warning for invalid categories
- [ ] Unit tests: single tag, multiple tags, invalid category, empty content, no tags, nested text

### Chat Context Builder
- [ ] Add `buildChatContext(userMessage)` to `MemoryContextBuilder`
- [ ] Pull recent preferences (top 10 by recency)
- [ ] Search for relevant facts matching user message keywords (all categories, limit 5)
- [ ] Return formatted `## Memory Context` block or empty string
- [ ] Unit tests for new method

### ChatHandler Integration
- [ ] Accept optional `MemoryRepo` in constructor (default: create new instance)
- [ ] Create `MemoryContextBuilder` from the repo
- [ ] Before AI call: append `buildChatContext(message)` to system prompt
- [ ] Append memory extraction instruction to system prompt (only when memoryRepo available)
- [ ] After AI call: run `extractAndSaveMemories()` on response
- [ ] Return cleaned response (tags stripped) — return type stays `string`
- [ ] Update tests: verify memory context injected, tags stripped, facts saved

### Telegram AIGateway Integration
- [ ] Create `MemoryRepo` and `MemoryContextBuilder` in constructor
- [ ] In `processMessage()`: inject memory context into system prompt
- [ ] After response: run `extractAndSaveMemories()`, return cleaned text
- [ ] Update tests

### ext-jobs Wiring
- [ ] Pass existing `memoryRepo` instance to `ChatHandler` constructor in IPC handlers

## Memory Extraction System Prompt

Appended to the chat system prompt when memory is available:

```
## Memory
When the user states a preference, makes a decision about their job search, shares personal
info relevant to applications, or corrects you — silently record it using this exact format:
<memory category="preference">the fact</memory>

Categories:
- preference: job preferences, dealbreakers, salary expectations, work style
- company: facts about specific companies (culture, tech stack, reputation)
- pattern: behavioral patterns (e.g., "always rejects DevOps roles")
- answer: reusable answers to common application questions

Rules:
- Do NOT mention that you are recording memories
- Do NOT add memory tags for trivial statements or greetings
- Only record genuinely useful facts for future job search assistance
- One fact per tag — keep facts atomic and concise
```

## Tag Format

```
<memory category="preference">Only interested in remote roles</memory>
<memory category="company">Stripe uses Ruby on Rails and has a strong engineering culture</memory>
<memory category="pattern">Consistently rejects roles requiring on-site presence</memory>
<memory category="answer">Has 8 years of React experience and led a team of 5 at previous role</memory>
```

## extractAndSaveMemories() Specification

```typescript
import { MemoryRepo, type MemoryFact, type MemoryCategory } from '../db/memory-repo'

export interface ExtractionResult {
  cleanedResponse: string
  savedFacts: MemoryFact[]
}

const MEMORY_TAG_REGEX = /<memory\s+category="([^"]+)">([\s\S]*?)<\/memory>/g
const VALID_CATEGORIES: Set<string> = new Set(['preference', 'company', 'pattern', 'answer'])

export function extractAndSaveMemories(
  response: string,
  memoryRepo: MemoryRepo
): ExtractionResult {
  const savedFacts: MemoryFact[] = []

  // Parse and save valid tags
  for (const match of response.matchAll(MEMORY_TAG_REGEX)) {
    const [, category, content] = match
    const trimmed = content.trim()
    if (!trimmed || !VALID_CATEGORIES.has(category)) continue
    const fact = memoryRepo.addFact(category as MemoryCategory, trimmed, 'chat', 0.8)
    savedFacts.push(fact)
  }

  // Strip ALL memory tags from response (valid or not)
  const cleanedResponse = response.replace(MEMORY_TAG_REGEX, '').trim()

  return { cleanedResponse, savedFacts }
}
```

## buildChatContext() Specification

```typescript
buildChatContext(userMessage: string): string {
  const sections: string[] = []

  // Recent user preferences
  const preferences = this.memoryRepo.getByCategory('preference', 10)
  if (preferences.length > 0) {
    sections.push(`### User Preferences\n${formatFacts(preferences)}`)
  }

  // Facts relevant to the current message
  const relevant = this.memoryRepo.search(userMessage, { limit: 5 })
  if (relevant.length > 0) {
    const newFacts = relevant.filter(
      (r) => !preferences.some((p) => p.id === r.fact.id)
    )
    if (newFacts.length > 0) {
      sections.push(`### Relevant Context\n${formatFacts(newFacts.map((r) => r.fact))}`)
    }
  }

  if (sections.length === 0) return ''
  return `## Memory Context\n${sections.join('\n\n')}`
}
```

## Example Flow

```
# Day 1: User shares preferences
User: "I'm a React developer looking for remote roles. I don't want anything under $150k."
AI response (raw): "I'll focus on remote React roles at $150k+. <memory category="preference">
  Only interested in remote roles</memory><memory category="preference">Minimum salary
  requirement: $150k</memory><memory category="preference">Primary skill: React
  development</memory>"
AI response (displayed): "I'll focus on remote React roles at $150k+."
→ 3 facts saved to memory_facts with source='chat', confidence=0.8

# Day 2: Chat uses stored memories
User: "Any good jobs today?"
→ buildChatContext("Any good jobs today?") returns:
  "## Memory Context
   ### User Preferences
   - [preference] Only interested in remote roles
   - [preference] Minimum salary requirement: $150k
   - [preference] Primary skill: React development"
→ Claude uses this context to filter and rank its response
```

## Success Criteria

- [ ] `extractAndSaveMemories()` parses tags, saves facts, strips tags
- [ ] `buildChatContext()` returns relevant memories or empty string
- [ ] ChatHandler reads memory context into system prompt
- [ ] ChatHandler saves extracted facts from responses
- [ ] Telegram AIGateway reads and writes memory
- [ ] Tags never visible to the user
- [ ] Invalid categories handled gracefully (stripped but not saved)
- [ ] All tests pass
