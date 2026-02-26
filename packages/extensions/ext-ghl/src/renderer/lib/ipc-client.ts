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

function invoke<T = unknown>(channel: string, data: unknown): Promise<IPCResult<T>> {
  return api.invoke(channel, data) as Promise<IPCResult<T>>
}

export const ipc = {
  settings: {
    get: (): Promise<
      IPCResult<{ token: string | null; hasToken: boolean; locationId: string | null }>
    > => invoke(EXT_GHL_IPC.SETTINGS_GET, {}),

    set: (data: { token?: string; locationId?: string }): Promise<IPCResult> =>
      invoke(EXT_GHL_IPC.SETTINGS_SET, data),

    testConnection: (): Promise<IPCResult<{ connected: boolean; contactCount: number }>> =>
      invoke(EXT_GHL_IPC.CONNECTION_TEST, {})
  },

  contacts: {
    list: (opts?: {
      query?: string
      limit?: number
      offset?: number
    }): Promise<IPCResult<GhlContactRow[]>> => invoke(EXT_GHL_IPC.CONTACTS_LIST, opts ?? {}),

    get: (id: string): Promise<IPCResult<GhlContactRow>> =>
      invoke(EXT_GHL_IPC.CONTACTS_GET, { id }),

    create: (contact: Record<string, unknown>): Promise<IPCResult<Contact>> =>
      invoke(EXT_GHL_IPC.CONTACTS_CREATE, { contact }),

    update: (id: string, data: Record<string, unknown>): Promise<IPCResult<Contact>> =>
      invoke(EXT_GHL_IPC.CONTACTS_UPDATE, { id, data }),

    delete: (id: string): Promise<IPCResult> => invoke(EXT_GHL_IPC.CONTACTS_DELETE, { id }),

    sync: (): Promise<IPCResult<{ synced: number }>> => invoke(EXT_GHL_IPC.CONTACTS_SYNC, {})
  },

  pipelines: {
    list: (): Promise<IPCResult<GhlPipelineRow[]>> => invoke(EXT_GHL_IPC.PIPELINES_LIST, {})
  },

  opportunities: {
    list: (opts?: {
      pipelineId?: string
      status?: string
    }): Promise<IPCResult<GhlOpportunityRow[]>> => invoke(EXT_GHL_IPC.OPPS_LIST, opts ?? {}),

    get: (id: string): Promise<IPCResult<GhlOpportunityRow>> =>
      invoke(EXT_GHL_IPC.OPPS_GET, { id }),

    create: (opportunity: Record<string, unknown>): Promise<IPCResult<Opportunity>> =>
      invoke(EXT_GHL_IPC.OPPS_CREATE, { opportunity }),

    update: (id: string, data: Record<string, unknown>): Promise<IPCResult<Opportunity>> =>
      invoke(EXT_GHL_IPC.OPPS_UPDATE, { id, data }),

    updateStatus: (id: string, status: string): Promise<IPCResult<Opportunity>> =>
      invoke(EXT_GHL_IPC.OPPS_UPDATE_STATUS, { id, status }),

    delete: (id: string): Promise<IPCResult> => invoke(EXT_GHL_IPC.OPPS_DELETE, { id }),

    sync: (): Promise<IPCResult<{ synced: number; pipelines: number }>> =>
      invoke(EXT_GHL_IPC.OPPS_SYNC, {})
  },

  conversations: {
    list: (opts?: { limit?: number; contactId?: string }): Promise<IPCResult<Conversation[]>> =>
      invoke(EXT_GHL_IPC.CONVS_LIST, opts ?? {}),

    get: (id: string): Promise<IPCResult<Conversation>> => invoke(EXT_GHL_IPC.CONVS_GET, { id }),

    messages: (conversationId: string, limit?: number): Promise<IPCResult<Message[]>> =>
      invoke(EXT_GHL_IPC.CONVS_MESSAGES, { conversationId, limit }),

    send: (
      contactId: string,
      type: 'SMS' | 'Email',
      message: string,
      subject?: string
    ): Promise<IPCResult> =>
      invoke(EXT_GHL_IPC.CONVS_SEND, {
        contactId,
        type,
        message,
        subject
      })
  },

  calendars: {
    list: (): Promise<IPCResult<Calendar[]>> => invoke(EXT_GHL_IPC.CALS_LIST, {}),

    events: (opts?: {
      calendarId?: string
      startTime?: string
      endTime?: string
    }): Promise<IPCResult<CalendarEvent[]>> => invoke(EXT_GHL_IPC.CAL_EVENTS_LIST, opts ?? {})
  },

  chat: {
    send: (message: string): Promise<IPCResult<string>> =>
      invoke(EXT_GHL_IPC.CHAT_SEND, { message }),

    clear: (): Promise<IPCResult> => invoke(EXT_GHL_IPC.CHAT_CLEAR, {})
  },

  customFields: {
    list: (): Promise<IPCResult<CustomFieldDef[]>> => invoke(EXT_GHL_IPC.CUSTOM_FIELDS_LIST, {})
  },

  arv: {
    start: (opts?: { pipelineName?: string; force?: boolean }): Promise<IPCResult> =>
      invoke(EXT_GHL_IPC.ARV_ENRICH_START, opts ?? {}),

    status: (): Promise<IPCResult> => invoke(EXT_GHL_IPC.ARV_ENRICH_STATUS, {})
  }
}

export type { IPCResult }
