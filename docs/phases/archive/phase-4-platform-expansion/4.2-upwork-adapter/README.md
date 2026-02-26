# 4.2: Upwork Adapter (COMPLETE ✓)

**Effort:** Moderate-High | **Status:** Complete

## Goal

Implement the full `PlatformAdapter` interface for Upwork. Note: Upwork is a freelance marketplace with a fundamentally different model — projects instead of jobs, proposals instead of applications.

## Tasks

### Implement UpworkAdapter
- [x] `src/main/platforms/upwork/upwork-adapter.ts`:
  - `buildSearchUrl()` — Upwork search with category, budget, experience level, client history filters
  - `extractListings()` — Extract project cards
  - `extractJobDetails()` — Extract project description, budget, timeline, client history, skills required
  - `hasNextPage()` / `goToNextPage()` — Pagination
  - `applyToJob()` — Proposal submission flow (uses `CoverLetterGenerator` adapted for proposals)

### Create UpworkExtractor
- [x] `src/main/platforms/upwork/upwork-extractor.ts`:
  - Parse project cards (title, budget, duration, client rating, proposals count)
  - Parse project detail (full description, attachments, questions, client spend history)

### Upwork-Specific Types
- [x] Add to `src/shared/types.ts`:
  - `UpworkProjectDetails` with: budget_type (fixed/hourly), budget_range, timeline, client_rating, client_total_spent, proposals_count, skills_required

### Populate Hint File
- [x] Fill in `hints/upwork-jobs.json` with selectors

### Proposal Generation
- [x] Adapt `CoverLetterGenerator` or create `ProposalGenerator`:
  - Upwork proposals have different conventions than cover letters
  - Include: opening hook, relevant experience, proposed approach, timeline, rate

## Files to Create/Modify

```
src/main/platforms/upwork/upwork-adapter.ts (implement from stub)
src/main/platforms/upwork/upwork-extractor.ts (new)
hints/upwork-jobs.json (populate)
src/shared/types.ts (Upwork-specific types)
```

## Success Criteria

- [x] Can search Upwork with configurable filters
- [x] Project details extracted including client history
- [x] Proposals generated with appropriate tone and content
- [x] Upwork projects appear alongside other platform jobs in UI
