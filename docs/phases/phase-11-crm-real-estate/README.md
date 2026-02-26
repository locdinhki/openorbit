# Phase 11: CRM & Real Estate Intelligence

**Theme:** Integrate GoHighLevel CRM and Zillow property data as full OpenOrbit extensions with AI-powered CRM chat, daily briefings, and cross-extension ARV enrichment automation.

**Effort:** Very High | **Depends on:** Phase 10.1 (Inline Memory Extraction) | **Status:** Not started

## Why This Phase

OpenOrbit's extension system is mature (7 extensions, scheduler with run history, AI provider registry, RPC server) but focused solely on job search. Meanwhile, a working GoHighLevel CRM connector exists as a standalone test project (`go high level connector/`) with:

- A proven GHL API SDK (contacts, opportunities, pipelines, calendars, conversations, custom fields)
- A Zillow scraper using Patchright that extracts Zestimate/ARV values
- A working ARV enrichment automation that scrapes Zillow for pipeline contacts and writes values back to GHL

This phase ports everything into proper OpenOrbit extensions:

- **ext-ghl** — Full CRM extension with sidebar, workspace, pipeline board, conversation threads, AI-powered chat assistant ("what tasks today?", "who needs follow-up?"), and daily briefing scheduler
- **ext-zillow** — Property data extension with Zillow scraping, ARV cache, and a property viewer UI. Exposes generic IPC channels (`ext-zillow:get-arv`) callable by any extension or automation

The Phase 10.1 prerequisite ensures the AI chat remembers CRM context across sessions via inline memory extraction.

## Subphases

| # | Subphase | Effort | Description |
|---|----------|--------|-------------|
| 11.1 | [ext-zillow Core](11.1-ext-zillow-core/) | Medium | Scraper, DB cache, IPC channels |
| 11.2 | [ext-zillow UI](11.2-ext-zillow-ui/) | Medium | Property viewer sidebar + workspace |
| 11.3 | [ext-ghl SDK Port](11.3-ext-ghl-sdk-port/) | Low | Port GHLClient + 5 resource classes |
| 11.4 | [ext-ghl Core](11.4-ext-ghl-core/) | High | DB migrations, repos, 28 IPC channels, settings |
| 11.5 | [ext-ghl Contacts + Pipeline UI](11.5-ext-ghl-contacts-pipeline-ui/) | High | Sidebar, contact list/detail, pipeline kanban board |
| 11.6 | [ext-ghl Conversations + Calendars UI](11.6-ext-ghl-conversations-calendars-ui/) | Medium | Conversation threads, calendar events (parallel with 11.5) |
| 11.7 | [ext-ghl AI Chat + Briefing](11.7-ext-ghl-ai-chat-briefing/) | High | Tool-calling chat handler, daily briefing scheduler |
| 11.8 | [Cross-ext ARV Enrichment](11.8-cross-ext-arv-enrichment/) | Medium | Port enrich-arv automation as scheduler task |
| 11.9 | [Tests](11.9-tests/) | Medium | ~42 new tests across both extensions |

## Architecture Overview

Both extensions follow the established extension pattern: `package.json` manifest with `openorbit` field, `ExtensionMainAPI` with `activate(ctx)`, constructor-DI repos, scoped IPC channels, and `ExtensionRendererAPI` registering views.

```
ext-zillow                              ext-ghl
  scraper/ (Patchright)                   sdk/ (HTTP API client)
  db/arv-cache-repo                       db/contacts-repo, opps-repo, pipelines-repo
  IPC: ext-zillow:search, get-arv         IPC: 28 channels (CRUD, sync, chat, arv)
  renderer/ (sidebar + workspace)         renderer/ (sidebar + workspace + chat panel)
       |                                       |
       +----------- cross-extension -----------+
       |  ext-ghl imports ZillowScraper from   |
       |  ext-zillow for ARV enrichment        |
       +---------------------------------------+
```

### Cross-Extension Communication

ext-ghl imports `ZillowScraper` and `ArvCacheRepo` directly from `@openorbit/ext-zillow` — both are statically bundled via `preloadedModules`. ext-zillow must activate before ext-ghl (alphabetical order handles this: `ext-ghl` > `ext-zillow` would NOT work — ext-zillow is registered first in `preloadedModules`).

### AI Chat Architecture

The GHL chat panel uses `completeWithTools` for an agentic loop. The AI has 6 tools to query CRM data:

| Tool | Data Source |
|------|-------------|
| `list_contacts` | Local cache |
| `get_contact` | Local cache |
| `list_opportunities` | Local cache |
| `list_calendar_events` | Live GHL API |
| `list_conversations` | Live GHL API |
| `list_pipelines` | Local cache |

### Scheduler Task Types

| Task Type | Extension | Description |
|-----------|-----------|-------------|
| `ghl-daily-briefing` | ext-ghl | AI-generated morning summary of tasks, appointments, follow-ups |
| `ghl-arv-enrichment` | ext-ghl | Batch Zillow scrape for pipeline contacts, writes ARV back to GHL |

## Implementation Order

```
11.1 ext-zillow Core    ──┐
11.3 ext-ghl SDK port   ──┘  (parallel)
         |                       |
11.2 ext-zillow UI      11.4 ext-ghl Core (DB + IPC)
                                 |
                    ┌────────────┼────────────┐
              11.5 Contacts  11.6 Convs+Cals  │  (parallel)
                    └────────────┬────────────┘
                          11.7 AI Chat + Briefing
                          11.8 ARV Enrichment (cross-ext)
                                 |
                          11.9 Tests
```

11.1 and 11.3 are fully independent and can proceed in parallel. 11.5 and 11.6 are independent UI tracks. 11.7 and 11.8 require both extensions' backends to be complete.

## New Packages Summary

| Package | Type | Settings Keys |
|---------|------|---------------|
| `@openorbit/ext-zillow` | Extension | `zillow.cache-ttl-days` |
| `@openorbit/ext-ghl` | Extension | `ghl.api-token`, `ghl.location-id`, `ghl.default-pipeline` |

## Success Criteria

- [ ] ext-zillow scrapes Zillow Zestimate for any US address
- [ ] ARV results cached with configurable TTL, cache browsable in UI
- [ ] ext-ghl connects to GoHighLevel via Private Integration Token
- [ ] Contacts list with search, sync from GHL API
- [ ] Pipeline kanban board showing opportunities by stage
- [ ] Conversation threads with send message (SMS/Email)
- [ ] Calendar events list (today/this week)
- [ ] AI chat answers "what tasks today?", "who needs follow-up?" using CRM tools
- [ ] Daily briefing scheduler generates and notifies morning summary
- [ ] ARV enrichment scheduler processes pipeline contacts via Zillow
- [ ] Cross-extension: contact detail "Get ARV" button calls ext-zillow
- [ ] All ~764 tests pass
- [ ] `npx electron-vite build` succeeds
