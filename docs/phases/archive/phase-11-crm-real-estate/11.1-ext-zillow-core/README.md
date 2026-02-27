# 11.1: ext-zillow Core Infrastructure

**Effort:** Medium | **Status:** Complete

## Background

The working Zillow scraper in the test project (`go high level connector/src/scraper/zillow.ts`) uses Patchright to navigate to Zillow, extract the Zestimate value, and return it. It currently owns its own browser context. This subphase ports it into a proper OpenOrbit extension that uses the shared `SessionManager` and adds a TTL-aware cache layer.

## Tasks

### Extension Scaffold
- [ ] Create `packages/extensions/ext-zillow/package.json` with `openorbit` manifest
  - id: `ext-zillow`, icon: `home`, activationEvents: `["onStartup"]`
  - contributes: sidebar (`zillow-sidebar`), workspace (`zillow-workspace`), panel (`zillow-cache`)
- [ ] Create `src/ipc-channels.ts` — `EXT_ZILLOW_IPC` const object
- [ ] Create `src/ipc-schemas.ts` — Zod schemas for all channels

### Zillow Scraper
- [ ] Create `src/main/scraper/zillow-scraper.ts`
- [ ] Port scraping logic verbatim from `go high level connector/src/scraper/zillow.ts`
- [ ] Replace `chromium.launchPersistentContext()` with `SessionManager` constructor injection
- [ ] Use `sessionManager.newPage()` for each scrape, close page in `finally`
- [ ] Keep random 5-10s delay between requests (anti-bot)
- [ ] Zestimate validation: must be `10,000 < value < 10,000,000`
- [ ] Return `{ zestimate: number | null, zillowUrl: string | null, error?: string }`

### Database Layer
- [ ] Create `src/main/db/migrations.ts` — V1: `arv_cache` table
- [ ] Create `src/main/db/arv-cache-repo.ts` with constructor DI (`Database.Database`)
- [ ] Methods: `getByAddress(key, maxAge)`, `insert()`, `list()`, `delete()`, `purgeExpired()`

### IPC Handlers
- [ ] Create `src/main/ipc-handlers.ts` — `registerExtZillowHandlers(ctx)`
- [ ] `ext-zillow:search` — scrape one address (cache-aware, `force` flag bypasses)
- [ ] `ext-zillow:get-arv` — alias for search (semantic name for cross-extension callers)
- [ ] `ext-zillow:cache-list` — list cached ARV entries
- [ ] `ext-zillow:cache-delete` — delete a cache entry by id
- [ ] `ext-zillow:cache-purge` — purge all expired entries
- [ ] `ext-zillow:scrape-progress` — push event for batch jobs

### Extension Entry
- [ ] Create `src/main/index.ts` — `ExtensionMainAPI` with `activate()`, `deactivate()`, `migrations`
- [ ] Register in `src/main/index.ts` (shell) — add to `preloadedModules`

## Scraper Adaptation

```typescript
// Before (test project): owns its own browser
class ZillowScraper {
  private context: BrowserContext | null = null
  async launch() { this.context = await chromium.launchPersistentContext(...) }
  async scrape(addr) { /* uses this.context */ }
  async close() { await this.context?.close() }
}

// After (extension): receives shared SessionManager
class ZillowScraper {
  constructor(private sessionManager: SessionManager) {}
  async scrape(addr: AddressInput): Promise<ZillowResult> {
    const page = await this.sessionManager.newPage()
    try {
      // Same DOM logic: build URL, navigate, extract Zestimate
    } finally {
      await page.close()
    }
  }
}
```

## DB Migration V1

```sql
CREATE TABLE IF NOT EXISTS arv_cache (
  id          TEXT PRIMARY KEY,
  address1    TEXT NOT NULL,
  city        TEXT NOT NULL,
  state       TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  address_key TEXT NOT NULL UNIQUE,
  zestimate   INTEGER,
  zillow_url  TEXT,
  error       TEXT,
  scraped_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_arv_cache_address_key ON arv_cache(address_key);
CREATE INDEX IF NOT EXISTS idx_arv_cache_scraped_at  ON arv_cache(scraped_at);
```

## IPC Channels

| Channel | Schema | Description |
|---------|--------|-------------|
| `ext-zillow:search` | `{ address1, city, state, postalCode, force? }` | Scrape or return cached ARV |
| `ext-zillow:get-arv` | Same as search | Alias for cross-extension callers |
| `ext-zillow:cache-list` | `{ limit?, offset? }` | List cached entries |
| `ext-zillow:cache-delete` | `{ id }` | Delete one cache entry |
| `ext-zillow:cache-purge` | `{}` | Purge all expired entries |
| `ext-zillow:scrape-progress` | Push | Progress updates for batch scrapes |

## IPC Handler Logic (search)

```typescript
ipc.handle(EXT_ZILLOW_IPC.SEARCH, schema, async (_event, { address1, city, state, postalCode, force }) => {
  const addressKey = buildAddressKey({ address1, city, state, postalCode })

  // Cache hit (default TTL: 30 days)
  if (!force) {
    const cached = cacheRepo.getByAddress(addressKey, CACHE_TTL_MS)
    if (cached) return { success: true, data: { ...cached, fromCache: true } }
  }

  await ctx.services.browser.ensureReady()
  const scraper = new ZillowScraper(ctx.services.browser.getSession())
  const result = await scraper.scrape({ address1, city, state, postalCode })

  cacheRepo.insert({ addressKey, address1, city, state, postalCode, ...result })
  return { success: true, data: { ...result, fromCache: false } }
})
```

## Success Criteria

- [ ] `ext-zillow:search` scrapes Zillow and returns Zestimate
- [ ] Results cached; repeat calls return from cache
- [ ] `force: true` bypasses cache
- [ ] `ext-zillow:cache-purge` removes expired entries
- [ ] Extension activates without errors on startup
