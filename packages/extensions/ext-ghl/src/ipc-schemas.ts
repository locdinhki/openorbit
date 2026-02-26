// ============================================================================
// ext-ghl — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

const customFieldValueSchema = z.object({
  id: z.string(),
  value: z.unknown()
})

export const extGhlSchemas = {
  // Settings
  'ext-ghl:settings-get': z.object({}),
  'ext-ghl:settings-set': z.object({
    token: z.string().optional(),
    locationId: z.string().optional()
  }),
  'ext-ghl:connection-test': z.object({}),

  // Contacts
  'ext-ghl:contacts-list': z.object({
    query: z.string().optional(),
    limit: z.number().int().min(1).max(500).optional(),
    offset: z.number().int().min(0).optional()
  }),
  'ext-ghl:contacts-get': z.object({ id: z.string().min(1) }),
  'ext-ghl:contacts-create': z.object({
    contact: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      companyName: z.string().optional(),
      address1: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      tags: z.array(z.string()).optional(),
      customFields: z.array(customFieldValueSchema).optional()
    })
  }),
  'ext-ghl:contacts-update': z.object({
    id: z.string().min(1),
    data: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      companyName: z.string().optional(),
      address1: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      tags: z.array(z.string()).optional(),
      customFields: z.array(customFieldValueSchema).optional()
    })
  }),
  'ext-ghl:contacts-delete': z.object({ id: z.string().min(1) }),
  'ext-ghl:contacts-sync': z.object({}),

  // Pipelines
  'ext-ghl:pipelines-list': z.object({}),

  // Opportunities
  'ext-ghl:opps-list': z.object({
    pipelineId: z.string().optional(),
    status: z.enum(['open', 'won', 'lost', 'abandoned']).optional()
  }),
  'ext-ghl:opps-get': z.object({ id: z.string().min(1) }),
  'ext-ghl:opps-create': z.object({
    opportunity: z.object({
      pipelineId: z.string(),
      name: z.string(),
      pipelineStageId: z.string(),
      status: z.enum(['open', 'won', 'lost', 'abandoned']),
      contactId: z.string(),
      monetaryValue: z.number().optional(),
      assignedTo: z.string().optional(),
      customFields: z.array(customFieldValueSchema).optional()
    })
  }),
  'ext-ghl:opps-update': z.object({
    id: z.string().min(1),
    data: z.object({
      name: z.string().optional(),
      pipelineStageId: z.string().optional(),
      monetaryValue: z.number().optional(),
      assignedTo: z.string().optional(),
      customFields: z.array(customFieldValueSchema).optional()
    })
  }),
  'ext-ghl:opps-update-status': z.object({
    id: z.string().min(1),
    status: z.enum(['open', 'won', 'lost', 'abandoned'])
  }),
  'ext-ghl:opps-delete': z.object({ id: z.string().min(1) }),
  'ext-ghl:opps-sync': z.object({}),

  // Conversations (live API)
  'ext-ghl:convs-list': z.object({
    limit: z.number().int().min(1).max(100).optional(),
    contactId: z.string().optional()
  }),
  'ext-ghl:convs-get': z.object({ id: z.string().min(1) }),
  'ext-ghl:convs-messages': z.object({
    conversationId: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional()
  }),
  'ext-ghl:convs-send': z.object({
    contactId: z.string().min(1),
    type: z.enum(['SMS', 'Email']),
    message: z.string().min(1),
    subject: z.string().optional()
  }),

  // Calendars (live API)
  'ext-ghl:cals-list': z.object({}),
  'ext-ghl:cal-events-list': z.object({
    calendarId: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional()
  }),

  // AI Chat
  'ext-ghl:chat-send': z.object({ message: z.string().min(1) }),
  'ext-ghl:chat-clear': z.object({}),

  // ARV Enrichment
  'ext-ghl:arv-enrich-start': z.object({
    pipelineName: z.string().optional(),
    arvFieldName: z.string().optional(),
    force: z.boolean().optional()
  }),
  'ext-ghl:arv-enrich-status': z.object({}),

  // Custom Fields
  'ext-ghl:custom-fields-list': z.object({})
} as const
