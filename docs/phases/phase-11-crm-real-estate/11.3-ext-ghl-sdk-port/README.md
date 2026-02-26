# 11.3: ext-ghl SDK Port

**Effort:** Low | **Depends on:** Nothing (parallel with 11.1) | **Status:** Not started

## Background

The GoHighLevel test project (`go high level connector/src/`) contains a complete, working HTTP SDK for the GHL API. This subphase copies it into the ext-ghl extension package with one fix: removing `cache: 'no-store'` from fetch calls (incompatible with Node.js/Electron's `fetch`).

## Source Files

From `/Users/vincentthieu/Documents/Github/go high level connector/src/`:

| Source | Destination | Changes |
|--------|-------------|---------|
| `client.ts` | `src/main/sdk/client.ts` | Remove `cache: 'no-store'` from fetch options |
| `types.ts` | `src/main/sdk/types.ts` | None — copy verbatim |
| `index.ts` | `src/main/sdk/index.ts` | Update import paths |
| `resources/contacts.ts` | `src/main/sdk/resources/contacts.ts` | Update import paths |
| `resources/opportunities.ts` | `src/main/sdk/resources/opportunities.ts` | Update import paths |
| `resources/calendars.ts` | `src/main/sdk/resources/calendars.ts` | Update import paths |
| `resources/conversations.ts` | `src/main/sdk/resources/conversations.ts` | Update import paths |
| `resources/customFields.ts` | `src/main/sdk/resources/custom-fields.ts` | Rename to kebab-case, update import paths |

## Tasks

- [ ] Create `packages/extensions/ext-ghl/src/main/sdk/client.ts` — port `GHLClient`, remove `cache: 'no-store'`
- [ ] Create `src/main/sdk/types.ts` — copy all GHL interfaces verbatim
- [ ] Create `src/main/sdk/index.ts` — copy `GoHighLevel` facade, update imports
- [ ] Create `src/main/sdk/resources/contacts.ts`
- [ ] Create `src/main/sdk/resources/opportunities.ts`
- [ ] Create `src/main/sdk/resources/calendars.ts`
- [ ] Create `src/main/sdk/resources/conversations.ts`
- [ ] Create `src/main/sdk/resources/custom-fields.ts` (renamed from `customFields.ts`)

## Key Fix: `cache: 'no-store'`

```typescript
// Before (browser-only option, throws in Node):
const res = await fetch(url, {
  method,
  headers: this.headers(!!body),
  body: body ? JSON.stringify(body) : undefined,
  cache: 'no-store',
})

// After:
const res = await fetch(url, {
  method,
  headers: this.headers(!!body),
  body: body ? JSON.stringify(body) : undefined,
})
```

## Authentication

GHL uses a **Private Integration Token** (`pit-xxx` prefix). Every request sends:

```
Authorization: Bearer <token>
Version: 2021-07-28
Accept: application/json
```

Base URL: `https://services.leadconnectorhq.com`

No OAuth flow, no token refresh. The token is stored in OpenOrbit settings as `ghl.api-token`.

## API Coverage

| Resource | Methods |
|----------|---------|
| Contacts | list, get, create, update, delete, upsert, search |
| Opportunities | search, get, create, update, delete, updateStatus, upsert, getPipelines |
| Calendars | list, get, create, update, delete, getFreeSlots, getEvents |
| Conversations | list, get, create, update, delete, getMessages, sendMessage |
| Custom Fields | list, get, create, update, delete, findOrCreate |

## API Quirks to Preserve

- Opportunities list uses `/opportunities/search` (not `/opportunities/`) with `location_id` and `pipeline_id` as snake_case query params
- Custom field monetary type is spelled `"MONETORY"` (GHL's actual API value)
- `GHLError` class preserves HTTP status code and error message from response body

## Success Criteria

- [ ] `GoHighLevel` class instantiates with an API token
- [ ] All 5 resource accessors (`contacts`, `opportunities`, `calendars`, `conversations`, `customFields`) are available
- [ ] TypeScript compilation succeeds with all types
