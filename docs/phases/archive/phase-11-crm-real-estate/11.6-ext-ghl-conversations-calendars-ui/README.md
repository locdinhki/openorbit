# 11.6: ext-ghl Conversations + Calendars UI

**Effort:** Medium | **Depends on:** 11.4 | **Can parallel with:** 11.5 | **Status:** Complete

## Background

This subphase adds the Conversations and Calendars tabs to the GHL sidebar. Unlike contacts and opportunities (which are synced to local cache), conversations and calendar events are fetched live from the GHL API since they change frequently.

## Tasks

### ConversationList
- [ ] Create `src/renderer/components/conversations/ConversationList.tsx`
- [ ] Sorted by most recent message
- [ ] Each row: contact name, last message preview (truncated 60 chars), timestamp
- [ ] Unread count badge
- [ ] Click → workspace shows ConversationThread

### ConversationThread
- [ ] Create `src/renderer/components/conversations/ConversationThread.tsx`
- [ ] Scrollable message list
- [ ] Inbound messages: left-aligned, light background
- [ ] Outbound messages: right-aligned, primary color background
- [ ] Timestamp on each message
- [ ] Send box at bottom: text input + type selector (SMS/Email) + send button
- [ ] Send calls `ext-ghl:convs-send`

### CalendarList
- [ ] Create `src/renderer/components/calendars/CalendarList.tsx`
- [ ] List of calendars with name and description
- [ ] Click → shows CalendarEvents for that calendar

### CalendarEvents
- [ ] Create `src/renderer/components/calendars/CalendarEvents.tsx`
- [ ] Date filter: Today / This Week / Custom range
- [ ] Event list: time, contact name, title, status badge (confirmed/cancelled/no-show)
- [ ] Duration display

### Sidebar Integration
- [ ] Wire Conversations tab in GhlSidebar → ConversationList
- [ ] Wire Calendars tab in GhlSidebar → CalendarList
- [ ] Wire workspace routing for ConversationThread and CalendarEvents

## Component Tree

```
GhlSidebar Tab: Conversations
  └── ConversationList
      └── click → GhlWorkspace: ConversationThread
          ├── MessageList
          │   ├── InboundMessage (left)
          │   └── OutboundMessage (right)
          └── SendBox (text + type + send)

GhlSidebar Tab: Calendars
  └── CalendarList
      └── click → GhlWorkspace: CalendarEvents
          ├── DateFilter (Today / Week / Custom)
          └── EventList
              └── EventRow (time, contact, title, status)
```

## Message Type Support

GHL supports multiple message types. The send box includes a type selector:

| Type | Description |
|------|-------------|
| `SMS` | Text message |
| `Email` | Email message |

Other types (`WhatsApp`, `FB`, `IG`, `Live_Chat`) are read-only — displayed in the thread but not sendable from OpenOrbit in this phase.

## Success Criteria

- [ ] Conversations tab lists recent conversations with unread badges
- [ ] Clicking a conversation shows message thread
- [ ] Messages display correctly (inbound left, outbound right)
- [ ] Send message works (SMS and Email types)
- [ ] Calendars tab lists calendars
- [ ] Calendar events display with date filter
- [ ] Event status badges render correctly
