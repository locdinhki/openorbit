// ============================================================================
// ext-ghl — Renderer IPC Client
// ============================================================================

import { EXT_GHL_IPC } from '../../ipc-channels'
import type { GhlContactRow } from '../../main/db/contacts-repo'
import type { GhlOpportunityRow } from '../../main/db/opportunities-repo'
import type { GhlPipelineRow } from '../../main/db/pipelines-repo'
import type {
  Contact,
  Opportunity,
  Calendar,
  CalendarEvent,
  Conversation,
  Message,
  CustomFieldDef
} from '../../main/sdk/types'

interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

const api = window.api

export const ipc = {
  settings: {
    get: (): Promise<
      IPCResult<{ token: string | null; hasToken: boolean; locationId: string | null }>
    > => api.invoke(EXT_GHL_IPC.SETTINGS_GET, {}) as Promise<IPCResult>,

    set: (data: { token?: string; locationId?: string }): Promise<IPCResult> =>
      api.invoke(EXT_GHL_IPC.SETTINGS_SET, data) as Promise<IPCResult>,

    testConnection: (): Promise<IPCResult<{ connected: boolean; contactCount: number }>> =>
      api.invoke(EXT_GHL_IPC.CONNECTION_TEST, {}) as Promise<IPCResult>
  },

  contacts: {
    list: (opts?: {
      query?: string
      limit?: number
      offset?: number
    }): Promise<IPCResult<GhlContactRow[]>> =>
      api.invoke(EXT_GHL_IPC.CONTACTS_LIST, opts ?? {}) as Promise<IPCResult>,

    get: (id: string): Promise<IPCResult<GhlContactRow>> =>
      api.invoke(EXT_GHL_IPC.CONTACTS_GET, { id }) as Promise<IPCResult>,

    create: (contact: Record<string, unknown>): Promise<IPCResult<Contact>> =>
      api.invoke(EXT_GHL_IPC.CONTACTS_CREATE, { contact }) as Promise<IPCResult>,

    update: (id: string, data: Record<string, unknown>): Promise<IPCResult<Contact>> =>
      api.invoke(EXT_GHL_IPC.CONTACTS_UPDATE, { id, data }) as Promise<IPCResult>,

    delete: (id: string): Promise<IPCResult> =>
      api.invoke(EXT_GHL_IPC.CONTACTS_DELETE, { id }) as Promise<IPCResult>,

    sync: (): Promise<IPCResult<{ synced: number }>> =>
      api.invoke(EXT_GHL_IPC.CONTACTS_SYNC, {}) as Promise<IPCResult>
  },

  pipelines: {
    list: (): Promise<IPCResult<GhlPipelineRow[]>> =>
      api.invoke(EXT_GHL_IPC.PIPELINES_LIST, {}) as Promise<IPCResult>
  },

  opportunities: {
    list: (opts?: {
      pipelineId?: string
      status?: string
    }): Promise<IPCResult<GhlOpportunityRow[]>> =>
      api.invoke(EXT_GHL_IPC.OPPS_LIST, opts ?? {}) as Promise<IPCResult>,

    get: (id: string): Promise<IPCResult<GhlOpportunityRow>> =>
      api.invoke(EXT_GHL_IPC.OPPS_GET, { id }) as Promise<IPCResult>,

    create: (opportunity: Record<string, unknown>): Promise<IPCResult<Opportunity>> =>
      api.invoke(EXT_GHL_IPC.OPPS_CREATE, { opportunity }) as Promise<IPCResult>,

    update: (id: string, data: Record<string, unknown>): Promise<IPCResult<Opportunity>> =>
      api.invoke(EXT_GHL_IPC.OPPS_UPDATE, { id, data }) as Promise<IPCResult>,

    updateStatus: (id: string, status: string): Promise<IPCResult<Opportunity>> =>
      api.invoke(EXT_GHL_IPC.OPPS_UPDATE_STATUS, { id, status }) as Promise<IPCResult>,

    delete: (id: string): Promise<IPCResult> =>
      api.invoke(EXT_GHL_IPC.OPPS_DELETE, { id }) as Promise<IPCResult>,

    sync: (): Promise<IPCResult<{ synced: number; pipelines: number }>> =>
      api.invoke(EXT_GHL_IPC.OPPS_SYNC, {}) as Promise<IPCResult>
  },

  conversations: {
    list: (opts?: { limit?: number; contactId?: string }): Promise<IPCResult<Conversation[]>> =>
      api.invoke(EXT_GHL_IPC.CONVS_LIST, opts ?? {}) as Promise<IPCResult>,

    get: (id: string): Promise<IPCResult<Conversation>> =>
      api.invoke(EXT_GHL_IPC.CONVS_GET, { id }) as Promise<IPCResult>,

    messages: (conversationId: string, limit?: number): Promise<IPCResult<Message[]>> =>
      api.invoke(EXT_GHL_IPC.CONVS_MESSAGES, { conversationId, limit }) as Promise<IPCResult>,

    send: (
      contactId: string,
      type: 'SMS' | 'Email',
      message: string,
      subject?: string
    ): Promise<IPCResult> =>
      api.invoke(EXT_GHL_IPC.CONVS_SEND, {
        contactId,
        type,
        message,
        subject
      }) as Promise<IPCResult>
  },

  calendars: {
    list: (): Promise<IPCResult<Calendar[]>> =>
      api.invoke(EXT_GHL_IPC.CALS_LIST, {}) as Promise<IPCResult>,

    events: (opts?: {
      calendarId?: string
      startTime?: string
      endTime?: string
    }): Promise<IPCResult<CalendarEvent[]>> =>
      api.invoke(EXT_GHL_IPC.CAL_EVENTS_LIST, opts ?? {}) as Promise<IPCResult>
  },

  chat: {
    send: (message: string): Promise<IPCResult<string>> =>
      api.invoke(EXT_GHL_IPC.CHAT_SEND, { message }) as Promise<IPCResult>,

    clear: (): Promise<IPCResult> => api.invoke(EXT_GHL_IPC.CHAT_CLEAR, {}) as Promise<IPCResult>
  },

  customFields: {
    list: (): Promise<IPCResult<CustomFieldDef[]>> =>
      api.invoke(EXT_GHL_IPC.CUSTOM_FIELDS_LIST, {}) as Promise<IPCResult>
  },

  arv: {
    start: (opts?: { pipelineName?: string; force?: boolean }): Promise<IPCResult> =>
      api.invoke(EXT_GHL_IPC.ARV_ENRICH_START, opts ?? {}) as Promise<IPCResult>,

    status: (): Promise<IPCResult> =>
      api.invoke(EXT_GHL_IPC.ARV_ENRICH_STATUS, {}) as Promise<IPCResult>
  }
}

export type { IPCResult }
