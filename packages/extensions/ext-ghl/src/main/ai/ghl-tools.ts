// ============================================================================
// ext-ghl — AI Tool Definitions for CRM queries
// ============================================================================

import type { AIToolDefinition } from '@openorbit/core/ai/provider-types'

export const GHL_TOOLS: AIToolDefinition[] = [
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
      properties: {
        contactId: { type: 'string' }
      },
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
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
]

export const GHL_SYSTEM_PROMPT = `You are a CRM assistant for GoHighLevel. You help the user manage their contacts, deals, appointments, and conversations. Use the available tools to query real data before answering questions. Be concise and actionable.

When the user asks about their schedule, tasks, or follow-ups, always check the calendar and conversations first. Summarize findings in bullet points.`
