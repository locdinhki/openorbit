# 11.5: ext-ghl Contacts + Pipeline UI

**Effort:** High | **Depends on:** 11.4 | **Status:** Not started

## Background

With the ext-ghl backend complete (11.4), this subphase adds the primary UI: a multi-tab sidebar, a contact list/detail workspace, a pipeline kanban board, and a connection settings panel. This is where the GHL data becomes visible and interactive.

## Tasks

### Extension Renderer Entry
- [ ] Create `src/renderer/index.ts` — `ExtensionRendererAPI`
- [ ] Register views: `ghl-sidebar`, `ghl-workspace`, `ghl-chat`, `ghl-sync-status`
- [ ] Register in `src/renderer/src/App.tsx` (shell) — add to `rendererModules`

### IPC Client
- [ ] Create `src/renderer/lib/ipc-client.ts` — typed wrappers for all ext-ghl channels

### Zustand Store
- [ ] Create `src/renderer/store/index.ts` — combined store
- [ ] `contactsSlice` — contacts list, selected contact, loading, search query
- [ ] `opportunitiesSlice` — pipelines, opportunities by pipeline, selected opportunity
- [ ] `settingsSlice` — connection settings, connected status
- [ ] `chatSlice` — chat messages, loading (used by 11.7)

### GhlSidebar
- [ ] Create `src/renderer/components/GhlSidebar.tsx`
- [ ] 4 tabs: **Contacts**, **Pipeline**, **Conversations** (11.6), **Calendars** (11.6)
- [ ] Settings icon/gear button at bottom → connection settings
- [ ] Sync button with loading indicator

### ContactList
- [ ] Create `src/renderer/components/contacts/ContactList.tsx`
- [ ] Searchable list with real-time filtering
- [ ] Each row: name, email/phone, company
- [ ] "Sync from GHL" button at top
- [ ] Click to select → workspace shows ContactDetail

### ContactDetail
- [ ] Create `src/renderer/components/contacts/ContactDetail.tsx`
- [ ] All GHL contact fields displayed
- [ ] Tags as colored badges
- [ ] Custom fields section (resolve field names via `custom-fields-list`)
- [ ] **ARV section**: if contact has address, show "Get ARV" button that calls `ext-zillow:get-arv`
- [ ] Display most recent Zestimate with Zillow link

### ContactForm
- [ ] Create `src/renderer/components/contacts/ContactForm.tsx`
- [ ] Create/edit contact form
- [ ] Save → calls `contacts-create` or `contacts-update`

### PipelineBoard
- [ ] Create `src/renderer/components/pipeline/PipelineBoard.tsx`
- [ ] Horizontal scrollable layout: one column per pipeline stage
- [ ] Column header: stage name + opportunity count
- [ ] Pipeline selector dropdown (if multiple pipelines exist)

### OpportunityCard
- [ ] Create `src/renderer/components/pipeline/OpportunityCard.tsx`
- [ ] Card: opportunity name, monetary value (formatted), contact name
- [ ] Status badge (open/won/lost/abandoned)
- [ ] Click → workspace shows OpportunityDetail
- [ ] No drag-and-drop in this phase (status change via detail view)

### OpportunityDetail
- [ ] Create `src/renderer/components/pipeline/OpportunityDetail.tsx`
- [ ] Full opportunity details
- [ ] Status dropdown to change status
- [ ] Contact link → navigates to ContactDetail
- [ ] Custom fields display

### GhlConnectionSettings
- [ ] Create `src/renderer/components/settings/GhlConnectionSettings.tsx`
- [ ] API token input (password field, masked display)
- [ ] Location ID input
- [ ] "Test Connection" button with success/error feedback
- [ ] "Save" button

## Component Tree

```
GhlSidebar
  ├── Tab: Contacts
  │   ├── SyncButton
  │   ├── SearchBar
  │   └── ContactList (click → workspace)
  ├── Tab: Pipeline
  │   └── PipelineSelector (click → workspace shows board)
  ├── Tab: Conversations (11.6)
  ├── Tab: Calendars (11.6)
  └── SettingsButton → GhlConnectionSettings

GhlWorkspace
  ├── ContactDetail (when contact selected)
  │   ├── ContactFields
  │   ├── TagsBadges
  │   ├── CustomFields
  │   └── ArvSection (Get ARV → ext-zillow:get-arv)
  ├── PipelineBoard (when pipeline tab active)
  │   └── columns of OpportunityCards
  └── OpportunityDetail (when opp selected)

ghl-sync-status (status bar)
  └── "GHL: Connected" / "GHL: Not configured" with sync timestamp
```

## Cross-Extension: "Get ARV" Button

The ContactDetail component's ARV section calls `ext-zillow:get-arv` via IPC with the contact's address:

```typescript
const handleGetArv = async () => {
  const result = await window.api.invoke('ext-zillow:get-arv', {
    address1: contact.address1,
    city: contact.city,
    state: contact.state,
    postalCode: contact.postalCode
  })
  if (result.success) setArv(result.data)
}
```

## Success Criteria

- [ ] Sidebar shows Contacts and Pipeline tabs
- [ ] Contact list loads from local cache with search
- [ ] Sync button pulls contacts from GHL API
- [ ] Contact detail shows all fields including custom fields
- [ ] "Get ARV" button calls ext-zillow and displays Zestimate
- [ ] Pipeline board renders stages as columns with opportunity cards
- [ ] Opportunity status can be changed via detail view
- [ ] Connection settings panel allows configuring API token
