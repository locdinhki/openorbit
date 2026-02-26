# 4.1: Indeed Adapter (COMPLETE ✓)

**Effort:** Moderate | **Status:** Complete

## Goal

Implement the full `PlatformAdapter` interface for Indeed, following LinkedIn's established pattern.

## Tasks

### Implement IndeedAdapter
- [x] `src/main/platforms/indeed/indeed-adapter.ts`:
  - `buildSearchUrl()` — Indeed uses `q=`, `l=`, `fromage=`, `jt=` params
  - `extractListings()` — Extract job cards from search results
  - `extractJobDetails()` — Extract from Indeed's side panel
  - `hasNextPage()` / `goToNextPage()` — Pagination
  - `applyToJob()` — Indeed Apply flow (simpler than LinkedIn Easy Apply)

### Create IndeedExtractor
- [x] `src/main/platforms/indeed/indeed-extractor.ts`:
  - Parse job cards (title, company, location, salary, posted date)
  - Parse job detail panel (full description, requirements, benefits)
  - Handle Indeed's dynamic content loading

### Populate Hint File
- [x] Fill in `hints/indeed-jobs.json` with selectors:
  - Search results container
  - Job card elements
  - Job detail panel
  - Apply button
  - Pagination controls

### Wire Into Pipeline
- [x] Update `ExtractionRunner.getAdapter()` to return `IndeedAdapter` for platform `'indeed'`
- [x] Add Indeed-specific search config fields to `SearchConfig` type if needed

## Files to Create/Modify

```
src/main/platforms/indeed/indeed-adapter.ts (implement from stub)
src/main/platforms/indeed/indeed-extractor.ts (new)
hints/indeed-jobs.json (populate)
src/main/automation/extraction-runner.ts (add to getAdapter)
```

## Success Criteria

- [x] Can search Indeed with configurable filters
- [x] Job cards extracted with all metadata
- [x] Job details extracted with full descriptions
- [x] Pagination works across multiple pages
- [x] Indeed jobs appear alongside LinkedIn jobs in the UI
