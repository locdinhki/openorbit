# 11.4: ext-ghl Core Infrastructure

**Effort:** High | **Depends on:** 11.3 | **Status:** Complete

## Background

This is the most substantial subphase. It establishes the full ext-ghl main-process layer: extension scaffold, DB schema with local caching, 28 IPC channels, settings integration, and scheduler task type stubs.

## Tasks

### Extension Scaffold
- [ ] Create `packages/extensions/ext-ghl/package.json` with `openorbit` manifest
  - id: `ext-ghl`, icon: `building-2`, activationEvents: `["onStartup"]`
  - contributes: sidebar (`ghl-sidebar`), workspace (`ghl-workspace`), panel (`ghl-chat`), statusBar (`ghl-sync-status`)
- [ ] Create `src/ipc-channels.ts` — `EXT_GHL_IPC` const object (28 channels)
- [ ] Create `src/ipc-schemas.ts` — Zod schemas for all channels

### Database Layer
- [ ] Create `src/main/db/migrations.ts` — V1: `ghl_contacts`, `ghl_opportunities`, `ghl_pipelines`
- [ ] Create `src/main/db/contacts-repo.ts` — `GhlContactsRepo` with constructor DI
- [ ] Create `src/main/db/opportunities-repo.ts` — `GhlOpportunitiesRepo` with constructor DI
- [ ] Create `src/main/db/pipelines-repo.ts` — `GhlPipelinesRepo` with constructor DI

### IPC Handlers
- [ ] Create `src/main/ipc-handlers.ts` — `registerExtGhlHandlers(ctx)`
- [ ] Settings handlers: `settings-get`, `settings-set`, `connection-test`
- [ ] Contacts handlers: `contacts-list`, `contacts-get`, `contacts-create`, `contacts-update`, `contacts-delete`, `contacts-sync`
- [ ] Pipeline handler: `pipelines-list`
- [ ] Opportunities handlers: `opps-list`, `opps-get`, `opps-create`, `opps-update`, `opps-update-status`, `opps-delete`, `opps-sync`
- [ ] Conversations handlers: `convs-list`, `convs-get`, `convs-messages`, `convs-send`
- [ ] Calendar handlers: `cals-list`, `cal-events-list`
- [ ] Chat handlers: `chat-send`, `chat-clear` (stub — implemented in 11.7)
- [ ] ARV handlers: `arv-enrich-start`, `arv-enrich-status` (stub — implemented in 11.8)
- [ ] Custom fields handler: `custom-fields-list`
- [ ] Push events: `sync-progress`, `arv-enrich-progress`

### Extension Entry
- [ ] Create `src/main/index.ts` — `ExtensionMainAPI`
- [ ] Register scheduler task type stubs: `ghl-daily-briefing`, `ghl-arv-enrichment`
- [ ] Register in `src/main/index.ts` (shell) — add to `preloadedModules` (after ext-zillow)

## DB Migration V1

```sql
CREATE TABLE IF NOT EXISTS ghl_contacts (
  id           TEXT PRIMARY KEY,
  location_id  TEXT NOT NULL,
  first_name   TEXT,
  last_name    TEXT,
  name         TEXT,
  email        TEXT,
  phone        TEXT,
  company_name TEXT,
  address1     TEXT,
  city         TEXT,
  state        TEXT,
  postal_code  TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',
  custom_fields TEXT NOT NULL DEFAULT '[]',
  raw          TEXT NOT NULL DEFAULT '{}',
  synced_at    TEXT NOT NULL DEFAULT (datetime('now')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ghl_opportunities (
  id                TEXT PRIMARY KEY,
  location_id       TEXT NOT NULL,
  name              TEXT NOT NULL,
  monetary_value    REAL,
  pipeline_id       TEXT NOT NULL,
  pipeline_stage_id TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open',
  contact_id        TEXT NOT NULL,
  assigned_to       TEXT,
  custom_fields     TEXT NOT NULL DEFAULT '[]',
  raw               TEXT NOT NULL DEFAULT '{}',
  synced_at         TEXT NOT NULL DEFAULT (datetime('now')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ghl_pipelines (
  id          TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  name        TEXT NOT NULL,
  stages      TEXT NOT NULL DEFAULT '[]',
  synced_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ghl_contacts_location ON ghl_contacts(location_id);
CREATE INDEX IF NOT EXISTS idx_ghl_contacts_email    ON ghl_contacts(email);
CREATE INDEX IF NOT EXISTS idx_ghl_opps_pipeline     ON ghl_opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_ghl_opps_contact      ON ghl_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_ghl_opps_status       ON ghl_opportunities(status);
```

## IPC Channels (28 total)

| Channel | Schema | Description |
|---------|--------|-------------|
| `ext-ghl:settings-get` | `{}` | Get API token + location ID (token masked) |
| `ext-ghl:settings-set` | `{ token?, locationId? }` | Save settings, reset client |
| `ext-ghl:connection-test` | `{}` | Test API connection, return location name |
| `ext-ghl:contacts-list` | `{ query?, limit?, offset? }` | List contacts from local cache |
| `ext-ghl:contacts-get` | `{ id }` | Get single contact |
| `ext-ghl:contacts-create` | `{ contact }` | Create in GHL + cache |
| `ext-ghl:contacts-update` | `{ id, data }` | Update in GHL + cache |
| `ext-ghl:contacts-delete` | `{ id }` | Delete from GHL + cache |
| `ext-ghl:contacts-sync` | `{}` | Pull all contacts from GHL API into local cache |
| `ext-ghl:pipelines-list` | `{}` | List pipelines from cache |
| `ext-ghl:opps-list` | `{ pipelineId?, status? }` | List opportunities |
| `ext-ghl:opps-get` | `{ id }` | Get single opportunity |
| `ext-ghl:opps-create` | `{ opportunity }` | Create in GHL + cache |
| `ext-ghl:opps-update` | `{ id, data }` | Update in GHL + cache |
| `ext-ghl:opps-update-status` | `{ id, status }` | Update status in GHL + cache |
| `ext-ghl:opps-delete` | `{ id }` | Delete from GHL + cache |
| `ext-ghl:opps-sync` | `{}` | Pull opportunities from GHL API into cache |
| `ext-ghl:convs-list` | `{ limit?, contactId? }` | List conversations (live API) |
| `ext-ghl:convs-get` | `{ id }` | Get conversation (live API) |
| `ext-ghl:convs-messages` | `{ conversationId, limit? }` | Get messages (live API) |
| `ext-ghl:convs-send` | `{ conversationId, type, message }` | Send message via GHL |
| `ext-ghl:cals-list` | `{}` | List calendars (live API) |
| `ext-ghl:cal-events-list` | `{ calendarId?, startTime?, endTime? }` | List events (live API) |
| `ext-ghl:chat-send` | `{ message }` | Send message to AI chat (stub until 11.7) |
| `ext-ghl:chat-clear` | `{}` | Clear chat history (stub until 11.7) |
| `ext-ghl:arv-enrich-start` | `{ pipelineName?, force? }` | Start ARV enrichment (stub until 11.8) |
| `ext-ghl:arv-enrich-status` | `{}` | Get enrichment status (stub until 11.8) |
| `ext-ghl:custom-fields-list` | `{}` | List custom field definitions (live API) |
| `ext-ghl:sync-progress` | Push | Sync progress events |
| `ext-ghl:arv-enrich-progress` | Push | ARV enrichment progress events |

## Settings Pattern

```typescript
let ghlClient: GoHighLevel | null = null

function getGhlClient(): GoHighLevel {
  if (!ghlClient) {
    const settings = new SettingsRepo()
    const token = settings.get('ghl.api-token') as string | null
    if (!token) throw new Error('GHL API token not configured')
    ghlClient = new GoHighLevel({ apiToken: token })
  }
  return ghlClient
}

function resetGhlClient(): void { ghlClient = null }
```

`settings-set` handler calls `resetGhlClient()` after saving so the next API call uses new credentials.

## Sync Pattern (contacts-sync)

```typescript
ipc.handle('ext-ghl:contacts-sync', schema, async () => {
  const ghl = getGhlClient()
  const locationId = getLocationId()
  let synced = 0, skip = 0

  while (true) {
    const { contacts, meta } = await ghl.contacts.list(locationId, { limit: 100, skip })
    for (const contact of contacts) {
      contactsRepo.upsert(toLocalContact(contact))
      synced++
    }
    ipc.push('ext-ghl:sync-progress', { synced, total: meta.total })
    if (contacts.length < 100) break
    skip += 100
  }

  return { success: true, data: { synced } }
})
```

## Settings Keys

| Key | Type | Description |
|-----|------|-------------|
| `ghl.api-token` | `string` | Private Integration Token (`pit-xxx`) |
| `ghl.location-id` | `string` | GHL location ID |
| `ghl.default-pipeline` | `string` | Default pipeline name for ARV enrichment |

## Success Criteria

- [ ] Extension activates on startup without errors
- [ ] `connection-test` returns success with valid token
- [ ] `contacts-sync` pulls contacts from GHL into local cache
- [ ] `opps-sync` pulls opportunities into local cache
- [ ] All 28 IPC channels registered and respond (stubs return placeholders for 11.7/11.8)
- [ ] Scheduler task types registered (stubs)
