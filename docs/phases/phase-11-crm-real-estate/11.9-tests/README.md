# 11.9: Tests

**Effort:** Medium | **Depends on:** 11.1-11.8 | **Status:** Not started

## Background

Following the established testing pattern (in-memory SQLite, mocked services, constructor DI), this subphase adds unit tests for both extensions' repositories, the Zillow scraper, the ARV enrichment runner, and the GHL chat handler.

## Test Files

### ext-zillow Tests

| File | What to test | Expected tests |
|------|-------------|----------------|
| `ext-zillow/src/main/db/__tests__/arv-cache-repo.test.ts` | `insert()`, `getByAddress()` with TTL, `list()`, `delete()`, `purgeExpired()`, duplicate address_key handling, null zestimate | ~8 |
| `ext-zillow/src/main/__tests__/zillow-scraper.test.ts` | URL building from address, `buildAddressKey()` normalization, result parsing, Zestimate validation bounds (10k-10M), mock SessionManager page interaction | ~5 |

### ext-ghl Tests

| File | What to test | Expected tests |
|------|-------------|----------------|
| `ext-ghl/src/main/db/__tests__/contacts-repo.test.ts` | `upsert()` insert + update, `getById()`, `list()` with query/limit/offset, `delete()`, `countAll()`, JSON fields (tags, customFields), search filtering | ~10 |
| `ext-ghl/src/main/db/__tests__/opportunities-repo.test.ts` | `upsert()`, `getById()`, `listByPipeline()`, `listByContact()`, `updateStatus()`, `delete()`, status enum values | ~8 |
| `ext-ghl/src/main/__tests__/arv-enrichment.test.ts` | Mock GHL client + ZillowScraper, verify: skip duplicate contacts, skip existing ARV, skip incomplete address, progress callbacks, Zestimate write-back, error handling | ~6 |
| `ext-ghl/src/main/__tests__/ghl-chat-handler.test.ts` | Mock AIService, verify: tool dispatch (list_contacts, get_contact, etc.), fallback without tools, chat history management, memory context injection | ~5 |

### Existing Test Updates

| File | Change |
|------|--------|
| `packages/core/src/__tests__/ipc-channels.test.ts` | Update channel count assertion to include ext-zillow (6) and ext-ghl (28) channels |

## Testing Patterns

### Repository Tests (in-memory SQLite)

```typescript
import Database from 'better-sqlite3'
import { ArvCacheRepo } from '../arv-cache-repo'
import { extZillowMigrations } from '../migrations'

describe('ArvCacheRepo', () => {
  let db: Database.Database
  let repo: ArvCacheRepo

  beforeEach(() => {
    db = new Database(':memory:')
    for (const m of extZillowMigrations) m.up(db)
    repo = new ArvCacheRepo(db)
  })

  afterEach(() => db.close())

  it('inserts and retrieves by address key', () => { /* ... */ })
  it('returns null for expired entries', () => { /* ... */ })
  it('purges expired entries', () => { /* ... */ })
})
```

### Scraper Tests (mocked SessionManager)

```typescript
describe('ZillowScraper', () => {
  it('builds correct Zillow URL from address', () => {
    const url = buildZillowUrl({ address1: '123 Main St', city: 'Houston', state: 'TX', postalCode: '77001' })
    expect(url).toContain('123-Main-St-Houston-TX-77001')
  })

  it('normalizes address key for deduplication', () => {
    const key1 = buildAddressKey({ address1: '123 Main St', city: 'Houston', state: 'TX', postalCode: '77001' })
    const key2 = buildAddressKey({ address1: '123 main st', city: 'houston', state: 'tx', postalCode: '77001' })
    expect(key1).toBe(key2)
  })

  it('validates Zestimate bounds', () => {
    expect(isValidZestimate(500000)).toBe(true)
    expect(isValidZestimate(5000)).toBe(false)      // too low
    expect(isValidZestimate(15000000)).toBe(false)   // too high
  })
})
```

### ARV Enrichment Tests (mocked dependencies)

```typescript
describe('ArvEnrichmentRunner', () => {
  it('skips contacts with existing ARV when force=false', async () => { /* ... */ })
  it('processes contacts with existing ARV when force=true', async () => { /* ... */ })
  it('skips contacts without complete address', async () => { /* ... */ })
  it('deduplicates contacts across opportunities', async () => { /* ... */ })
  it('reports progress for each processed contact', async () => { /* ... */ })
  it('writes Zestimate back to GHL custom field', async () => { /* ... */ })
})
```

### Chat Handler Tests (mocked AI)

```typescript
describe('GhlChatHandler', () => {
  it('dispatches list_contacts tool to repo', async () => { /* ... */ })
  it('dispatches list_calendar_events tool to live API', async () => { /* ... */ })
  it('maintains chat history up to 20 messages', async () => { /* ... */ })
  it('falls back to simple chat when tools unavailable', async () => { /* ... */ })
  it('injects memory context when available', async () => { /* ... */ })
})
```

## Expected Results

- ~42 new tests across 6 test files
- Total test count: ~764 (up from 722)
- All tests pass: `npx vitest run`
- No regressions in existing test suites

## Success Criteria

- [ ] All new test files created and passing
- [ ] `npx vitest run` — all ~764 tests pass
- [ ] IPC channel count assertion updated
- [ ] Coverage on new repo files > 80%
