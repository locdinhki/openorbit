# 11.7: ext-ghl AI Chat + Daily Briefing

**Effort:** High | **Depends on:** 11.4, 11.5 | **Status:** Complete

## Background

This is the AI-powered core of ext-ghl. A tool-calling chat handler lets users ask natural language questions about their CRM: "what tasks do I have today?", "any conversations I need to follow up on?", "show me open deals over $50k". A daily briefing scheduler generates a morning summary automatically.

The chat handler uses `completeWithTools` for an agentic loop — the AI calls tools to query CRM data, receives structured results, and formulates a natural language response.

## Tasks

### AI Tool Definitions
- [ ] Create `src/main/ai/ghl-tools.ts` — 6 tool definitions
- [ ] `list_contacts` — search/list CRM contacts
- [ ] `get_contact` — get full contact details by ID
- [ ] `list_opportunities` — list pipeline opportunities with filters
- [ ] `list_calendar_events` — list upcoming calendar appointments
- [ ] `list_conversations` — list recent conversations
- [ ] `list_pipelines` — list all pipelines and stages

### GHL Chat Handler
- [ ] Create `src/main/ai/ghl-chat-handler.ts`
- [ ] Constructor: `AIService`, `GhlContactsRepo`, `GhlOpportunitiesRepo`, `GoHighLevel` client
- [ ] `sendMessage(message)` — agentic loop with `completeWithTools`
- [ ] `executeTool(call)` — dispatch to repos (cached) or GHL API (live)
- [ ] Chat history management (last 20 messages)
- [ ] Fallback: if provider doesn't support tools, use simple `chat()` with data snapshot
- [ ] Phase 10.1 integration: inject memory context via `buildChatContext()`, extract memories from responses

### Briefing Generator
- [ ] Create `src/main/ai/briefing-generator.ts`
- [ ] `generate(locationId)` — fetches today's events, recent conversations, open opportunities in parallel
- [ ] Asks AI for a concise daily briefing summary
- [ ] Returns formatted text

### Scheduler Task Implementation
- [ ] Replace `ghl-daily-briefing` stub handler in `main/index.ts` with real `BriefingGenerator`
- [ ] On completion: push desktop notification with briefing summary (first 200 chars)

### IPC Handler Updates
- [ ] Wire `ext-ghl:chat-send` to `GhlChatHandler.sendMessage()`
- [ ] Wire `ext-ghl:chat-clear` to clear chat history

### Chat Panel UI
- [ ] Create `src/renderer/components/GhlChatPanel.tsx`
- [ ] Registered as `ghl-chat` panel contribution
- [ ] Message bubbles: user messages right, AI responses left
- [ ] Markdown rendering for AI responses
- [ ] Loading indicator while AI is thinking / calling tools
- [ ] Clear chat button

## AI Tools

```typescript
const GHL_TOOLS = [
  {
    name: 'list_contacts',
    description: 'Search and list CRM contacts',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search by name, email, phone, company' },
        limit: { type: 'number', description: 'Max results (default 10)' }
      }
    }
  },
  {
    name: 'get_contact',
    description: 'Get full details of a specific contact',
    inputSchema: {
      type: 'object',
      properties: { contactId: { type: 'string' } },
      required: ['contactId']
    }
  },
  {
    name: 'list_opportunities',
    description: 'List pipeline opportunities',
    inputSchema: {
      type: 'object',
      properties: {
        pipelineId: { type: 'string' },
        status: { type: 'string', enum: ['open', 'won', 'lost', 'abandoned'] },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'list_calendar_events',
    description: 'List upcoming calendar appointments',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: { type: 'string' },
        startTime: { type: 'string', description: 'ISO 8601' },
        endTime: { type: 'string', description: 'ISO 8601' }
      }
    }
  },
  {
    name: 'list_conversations',
    description: 'List recent conversations',
    inputSchema: {
      type: 'object',
      properties: {
        contactId: { type: 'string' },
        limit: { type: 'number' }
      }
    }
  },
  {
    name: 'list_pipelines',
    description: 'List all pipelines and their stages',
    inputSchema: { type: 'object', properties: {} }
  }
]
```

## Tool Data Sources

| Tool | Source | Why |
|------|--------|-----|
| `list_contacts` | Local cache (`GhlContactsRepo`) | Fast, always available |
| `get_contact` | Local cache | Fast |
| `list_opportunities` | Local cache (`GhlOpportunitiesRepo`) | Fast |
| `list_calendar_events` | **Live GHL API** | Events change frequently, not cached |
| `list_conversations` | **Live GHL API** | Messages arrive in real-time |
| `list_pipelines` | Local cache (`GhlPipelinesRepo`) | Rarely changes |

## Agentic Loop

```
User: "What do I have today?"
  → AI calls list_calendar_events({ startTime: today, endTime: tomorrow })
  → Tool returns: [{ time: "9:00 AM", contact: "John", title: "Follow-up call" }, ...]
  → AI calls list_conversations({ limit: 10 })
  → Tool returns: [{ contact: "Jane", lastMessage: "When can we schedule?", unread: 2 }, ...]
  → AI synthesizes: "You have 3 appointments today..."
```

## Daily Briefing

```
Scheduled at 8:00 AM (configurable cron):
  1. Fetch today's calendar events (all calendars)
  2. Fetch recent conversations (last 20)
  3. Fetch open opportunities (top 50)
  4. Ask AI: "Create a concise daily briefing from this data"
  5. Push desktop notification with summary
```

## System Prompt

```
You are a CRM assistant for GoHighLevel. You help the user manage their contacts,
deals, appointments, and conversations. Use the available tools to query real data
before answering questions. Be concise and actionable.

When the user asks about their schedule, tasks, or follow-ups, always check the
calendar and conversations first. Summarize findings in bullet points.
```

## Success Criteria

- [ ] "What tasks do I have today?" → AI queries calendar, returns appointments
- [ ] "Any conversations to follow up?" → AI queries conversations, highlights unread
- [ ] "Show me open deals" → AI queries opportunities, summarizes by pipeline stage
- [ ] "Find contact John" → AI searches contacts, returns matches
- [ ] Chat history maintained across messages (up to 20)
- [ ] Daily briefing generates and pushes notification on schedule
- [ ] Memory context injected (Phase 10.1 dependency)
