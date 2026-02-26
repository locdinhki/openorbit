# 3.2: Memory System (COMPLETE ✓)

**Effort:** Moderate | **Status:** Complete

## Background

From [OpenClaw Analysis Section 4C](../../research/openclaw-analysis.md): sqlite-vec + FTS5 enable hybrid vector + keyword search. From [Section 7](../../research/openclaw-analysis.md): OpenClaw's MEMORY.md pattern shows how an AI agent can learn and adapt over time.

Currently, OpenOrbit forgets everything between sessions. The job analyzer has no memory of past decisions. The answer generator has no memory of past answers.

## Tasks

### Database Setup
- [x] Install `sqlite-vec` native module
- [x] Enable FTS5 in better-sqlite3
- [x] Create migration with new tables:
  - `memory_facts`: `id`, `category`, `content`, `embedding` (F32_BLOB for sqlite-vec), `created_at`
  - `memory_fts`: FTS5 virtual table on `memory_facts.content` for keyword search
- [x] Categories:
  - `preference` — "Prefers remote roles", "Rejects DevOps positions"
  - `company` — "Applied to Acme Corp 3 times, always rejected"
  - `pattern` — "Easy Apply salary questions: use $85-120/hr"
  - `answer` — Successful answers to common questions

### Memory Repository
- [x] Create `src/main/db/memory-repo.ts`:
  - `addFact(category, content)` — store with embedding
  - `search(query)` — hybrid: vector similarity + FTS5 BM25 ranking
  - `getRecentFacts(category, limit)` — latest facts by category
  - `deleteFact(id)` — remove outdated facts

### Memory Context Builder
- [x] Create `src/main/ai/memory-context.ts`:
  - Takes a query, searches memory, formats results as context string
  - Injected into Claude prompts before analysis/generation

### AI Integration
- [x] Modify `src/main/ai/job-analyzer.ts`:
  - Before scoring: query memory for preferences and company history
  - Inject memory context into system prompt
- [x] Modify `src/main/ai/answer-generator.ts`:
  - Before generating: query for past successful answers to similar questions
  - Prefer reusing proven answers
- [x] Write facts after key events:
  - User approves/rejects a job → preference fact
  - Successful application → answer facts
  - User edits a score/answer → correction fact (learning loop)

### IPC
- [x] Add memory management channels to `ipc-channels.ts`
- [x] Add handlers for viewing/editing memory facts in UI

## Files to Create

```
src/main/db/memory-repo.ts
src/main/ai/memory-context.ts
```

## Files to Modify

```
package.json (sqlite-vec dependency)
src/main/db/database.ts (new migration)
src/main/ai/job-analyzer.ts (query memory before analysis)
src/main/ai/answer-generator.ts (query memory for past answers)
src/shared/ipc-channels.ts (memory channels)
src/main/ipc-handlers.ts (memory handlers)
```

## Success Criteria

- [x] After rejecting 5 DevOps roles, system scores them lower automatically
- [x] Past successful answers to "Why are you interested?" reused as context
- [x] Hybrid search (vector + keyword) returns relevant facts in <50ms
- [x] Memory facts viewable and editable in UI
