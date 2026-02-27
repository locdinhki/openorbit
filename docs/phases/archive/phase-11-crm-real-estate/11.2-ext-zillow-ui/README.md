# 11.2: ext-zillow Renderer UI

**Effort:** Medium | **Depends on:** 11.1 | **Status:** Complete

## Background

With the ext-zillow backend complete (11.1), this subphase adds a full property viewer UI: a sidebar for address lookup, a workspace for displaying results, and a panel for browsing the ARV cache.

## Tasks

### Extension Renderer Entry
- [ ] Create `src/renderer/index.ts` — `ExtensionRendererAPI`
- [ ] Register views: `zillow-sidebar`, `zillow-workspace`, `zillow-cache`
- [ ] Register in `src/renderer/src/App.tsx` (shell) — add to `rendererModules`

### IPC Client
- [ ] Create `src/renderer/lib/ipc-client.ts` — typed wrappers for all ext-zillow channels

### Store
- [ ] Create `src/renderer/store/index.ts` — Zustand store
- [ ] State: `currentResult`, `recentLookups`, `cacheEntries`, `isLoading`, `error`

### ZillowSidebar
- [ ] Create `src/renderer/components/ZillowSidebar.tsx`
- [ ] Two tabs: **Lookup** and **History**
- [ ] Lookup tab: form with address1, city, state, postal code fields + "Search Zillow" button
- [ ] History tab: list of recent cache entries (address, zestimate, date), click to view in workspace
- [ ] Loading state while scraping (skeleton or spinner)

### ZillowWorkspace
- [ ] Create `src/renderer/components/ZillowWorkspace.tsx`
- [ ] Large Zestimate display with currency formatting
- [ ] Address display
- [ ] Zillow URL as external link button
- [ ] "From cache" badge with timestamp when result is cached
- [ ] ARV history chart: prior values for the same address over time (CSS bar chart, no charting library)
- [ ] Empty state when no lookup selected

### ArvCachePanel
- [ ] Create `src/renderer/components/ArvCachePanel.tsx`
- [ ] Table of all cached ARV entries (address, zestimate, scraped date)
- [ ] Delete individual entries
- [ ] "Purge Expired" button
- [ ] Entry count display

## Component Tree

```
ZillowSidebar
  ├── Tab: Lookup
  │   └── AddressForm (address1, city, state, postalCode, submit)
  └── Tab: History
      └── CacheEntryList (click → workspace)

ZillowWorkspace
  ├── ZestimateDisplay (large number, currency format)
  ├── AddressLine
  ├── ZillowLink (external)
  ├── CacheBadge (from cache, scraped at)
  └── ArvHistoryChart (CSS bars)

ArvCachePanel (panel)
  ├── CacheTable (address, value, date, delete)
  └── PurgeButton
```

## Success Criteria

- [ ] Sidebar loads with Lookup form
- [ ] Entering address and clicking Search shows Zestimate in workspace
- [ ] History tab shows recent lookups
- [ ] Cache panel shows all cached entries with delete and purge
- [ ] Loading states display correctly while scraping
