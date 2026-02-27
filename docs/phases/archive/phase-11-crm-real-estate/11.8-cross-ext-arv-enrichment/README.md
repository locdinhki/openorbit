# 11.8: Cross-Extension ARV Enrichment

**Effort:** Medium | **Depends on:** 11.1 (ext-zillow), 11.4 (ext-ghl) | **Status:** Complete

## Background

The test project's `enrich-arv.ts` script is the most valuable automation: it finds all opportunities in a GHL pipeline, scrapes Zillow for each contact's property ARV (Zestimate), and writes the value back to a GHL custom field. This subphase ports that automation as a proper scheduler task in ext-ghl that calls ext-zillow's scraper.

## Source

Port from: `/Users/vincentthieu/Documents/Github/go high level connector/examples/enrich-arv.ts`

## Tasks

### ArvEnrichmentRunner
- [ ] Create `src/main/automation/arv-enrichment.ts`
- [ ] `ArvEnrichmentRunner` class with constructor DI: `GoHighLevel`, `SessionManager`, `Database.Database`, `ProgressCallback`
- [ ] `run(config)` method — main enrichment loop
- [ ] Import `ZillowScraper` from `@openorbit/ext-zillow` (direct import, both statically bundled)
- [ ] Import `ArvCacheRepo` from `@openorbit/ext-zillow` for cache writes
- [ ] Progress reporting via callback → pushed to renderer via IPC

### DB Migration V2
- [ ] Add `ghl_arv_runs` table to track enrichment run history

### Scheduler Task
- [ ] Replace `ghl-arv-enrichment` stub in `main/index.ts` with real handler
- [ ] Config schema: `pipelineName` (text), `arvFieldName` (text)
- [ ] Browser lifecycle: `ensureReady()` before, `session.close()` in `finally`

### IPC Handler Updates
- [ ] Wire `ext-ghl:arv-enrich-start` to `ArvEnrichmentRunner.run()` (async, non-blocking)
- [ ] Wire `ext-ghl:arv-enrich-status` to return current run progress

## Enrichment Flow

```
1. Ensure ARV custom field exists in GHL
   → customFields.findOrCreate(locationId, "ARV", "MONETORY")

2. Find target pipeline
   → opportunities.getPipelines(locationId)
   → find pipeline by name (default: "Ready for SMS")

3. Fetch all opportunities in pipeline
   → opportunities.search({ location_id, pipeline_id, limit: 100 })

4. For each opportunity:
   a. Skip if contact already processed (dedup by contactId)
   b. Fetch contact details → contacts.get(contactId)
   c. Skip if already has ARV value (unless force=true)
   d. Skip if incomplete address (missing address1, city, state, or postalCode)
   e. Scrape Zillow → scraper.scrape({ address1, city, state, postalCode })
   f. Cache result → cacheRepo.insert(...)
   g. If Zestimate found: update GHL contact custom field
      → contacts.update(contactId, { customFields: [{ id: arvFieldId, value: zestimate }] })
   h. Random 5-10s delay (anti-bot)
   i. Report progress via callback

5. Return summary: { total, enriched, skipped, errors }
```

## DB Migration V2

```sql
CREATE TABLE IF NOT EXISTS ghl_arv_runs (
  id            TEXT PRIMARY KEY,
  pipeline_name TEXT NOT NULL,
  location_id   TEXT NOT NULL,
  total         INTEGER NOT NULL DEFAULT 0,
  enriched      INTEGER NOT NULL DEFAULT 0,
  skipped       INTEGER NOT NULL DEFAULT 0,
  errors        INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'running',
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);
```

## Scheduler Task Registration

```typescript
ctx.services.scheduler.registerTaskType(
  'ghl-arv-enrichment',
  async (config) => {
    await ctx.services.browser.ensureReady()
    try {
      const runner = new ArvEnrichmentRunner(ghl, session, ctx.db, (progress) => {
        try { ctx.ipc.push(EXT_GHL_IPC.ARV_ENRICH_PROGRESS, progress) } catch {}
      })
      await runner.run({
        pipelineName: (config.pipelineName as string) ?? 'Ready for SMS',
        arvFieldName: (config.arvFieldName as string) ?? 'ARV',
        force: false,
        locationId
      })
    } finally {
      try { session.close() } catch {}
    }
  },
  {
    label: 'GHL ARV Enrichment',
    description: 'Scrape Zillow Zestimate for pipeline contacts, write back to GHL',
    extensionId: 'ext-ghl',
    configSchema: [
      { key: 'pipelineName', type: 'text', label: 'Pipeline Name', defaultValue: 'Ready for SMS' },
      { key: 'arvFieldName', type: 'text', label: 'ARV Field Name', defaultValue: 'ARV' }
    ]
  }
)
```

## Cross-Extension Import

ext-ghl directly imports from ext-zillow (both are statically bundled via `preloadedModules`):

```typescript
import { ZillowScraper } from '@openorbit/ext-zillow/main/scraper/zillow-scraper'
import { ArvCacheRepo } from '@openorbit/ext-zillow/main/db/arv-cache-repo'
```

This requires ext-zillow to be registered in `preloadedModules` before ext-ghl.

## Progress Reporting

```typescript
interface EnrichmentProgress {
  total: number
  processed: number
  enriched: number
  skipped: number
  errors: number
  current?: string  // current address being processed
}
```

Pushed via `ext-ghl:arv-enrich-progress` IPC channel. The renderer can display a progress bar during enrichment.

## Success Criteria

- [ ] ARV enrichment processes all opportunities in configured pipeline
- [ ] Zestimate values written back to GHL custom field
- [ ] Contacts with existing ARV skipped (unless force=true)
- [ ] Contacts without address skipped
- [ ] Results cached in ext-zillow's `arv_cache` table
- [ ] Progress reported to renderer during run
- [ ] Run history recorded in `ghl_arv_runs` table
- [ ] Scheduler task configurable with pipeline name and field name
- [ ] Browser closed in `finally` after enrichment
