// ============================================================================
// ext-jobs — Renderer IPC Client
//
// Typed wrappers around window.api.invoke for ext-jobs channels.
// Shell channels (session, browser, screencast, settings) are re-exported
// from the shell's ipc-client.
// ============================================================================

import { EXT_JOBS_IPC } from '../../ipc-channels'
import type { SearchProfile, JobListing, JobStatus, AutomationStatus } from '@openorbit/core/types'
import type { ChatSession, ChatSessionMessage } from '../../chat-types'

interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

const api = window.api

export const ipc = {
  profiles: {
    list: (): Promise<IPCResult<SearchProfile[]>> =>
      api.invoke(EXT_JOBS_IPC.PROFILES_LIST) as Promise<IPCResult<SearchProfile[]>>,

    create: (
      profile: Omit<SearchProfile, 'id' | 'createdAt' | 'updatedAt'>
    ): Promise<IPCResult<SearchProfile>> =>
      api.invoke(EXT_JOBS_IPC.PROFILES_CREATE, { profile }) as Promise<IPCResult<SearchProfile>>,

    update: (
      id: string,
      updates: Partial<Omit<SearchProfile, 'id' | 'createdAt' | 'updatedAt'>>
    ): Promise<IPCResult<SearchProfile>> =>
      api.invoke(EXT_JOBS_IPC.PROFILES_UPDATE, { id, updates }) as Promise<
        IPCResult<SearchProfile>
      >,

    delete: (id: string): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.PROFILES_DELETE, { id }) as Promise<IPCResult>
  },

  jobs: {
    list: (filters?: {
      status?: JobStatus | JobStatus[]
      platform?: string
      profileId?: string
      minScore?: number
      limit?: number
      offset?: number
    }): Promise<IPCResult<JobListing[]>> =>
      api.invoke(EXT_JOBS_IPC.LIST, { filters }) as Promise<IPCResult<JobListing[]>>,

    update: (
      id: string,
      updates: { status?: JobStatus; userNotes?: string }
    ): Promise<IPCResult<JobListing>> =>
      api.invoke(EXT_JOBS_IPC.UPDATE, { id, updates }) as Promise<IPCResult<JobListing>>,

    approve: (id: string): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.APPROVE, { id }) as Promise<IPCResult>,

    reject: (id: string): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.REJECT, { id }) as Promise<IPCResult>,

    delete: (id: string): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.DELETE, { id }) as Promise<IPCResult>,

    refetch: (): Promise<IPCResult<{ updated: number; total: number }>> =>
      api.invoke(EXT_JOBS_IPC.REFETCH, {}) as Promise<IPCResult<{ updated: number; total: number }>>
  },

  automation: {
    start: (profileId?: string): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.AUTOMATION_START, { profileId }) as Promise<IPCResult>,

    stop: (): Promise<IPCResult> => api.invoke(EXT_JOBS_IPC.AUTOMATION_STOP) as Promise<IPCResult>,

    pause: (): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.AUTOMATION_PAUSE) as Promise<IPCResult>,

    status: (): Promise<AutomationStatus> =>
      api.invoke(EXT_JOBS_IPC.AUTOMATION_STATUS) as Promise<AutomationStatus>
  },

  chat: {
    send: (message: string, selectedJobId?: string): Promise<IPCResult<string>> =>
      api.invoke(EXT_JOBS_IPC.CHAT_SEND, { message, selectedJobId }) as Promise<IPCResult<string>>,

    analyzeJob: (jobId: string): Promise<IPCResult<JobListing>> =>
      api.invoke(EXT_JOBS_IPC.CHAT_ANALYZE_JOB, { jobId }) as Promise<IPCResult<JobListing>>,

    clear: (): Promise<IPCResult> => api.invoke(EXT_JOBS_IPC.CHAT_CLEAR, {}) as Promise<IPCResult>
  },

  sessions: {
    list: (limit?: number): Promise<IPCResult<ChatSession[]>> =>
      api.invoke(EXT_JOBS_IPC.SESSIONS_LIST, { limit }) as Promise<IPCResult<ChatSession[]>>,

    create: (title?: string): Promise<IPCResult<ChatSession>> =>
      api.invoke(EXT_JOBS_IPC.SESSIONS_CREATE, { title }) as Promise<IPCResult<ChatSession>>,

    load: (sessionId: string): Promise<IPCResult<ChatSessionMessage[]>> =>
      api.invoke(EXT_JOBS_IPC.SESSIONS_LOAD, { sessionId }) as Promise<
        IPCResult<ChatSessionMessage[]>
      >,

    delete: (sessionId: string): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.SESSIONS_DELETE, { sessionId }) as Promise<IPCResult>,

    rename: (sessionId: string, title: string): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.SESSIONS_RENAME, { sessionId, title }) as Promise<IPCResult>
  },

  application: {
    start: (jobId: string): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.APPLICATION_START, { jobId }) as Promise<IPCResult>,

    answer: (answer: string): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.APPLICATION_ANSWER, { answer }) as Promise<IPCResult>
  },

  actionLog: {
    list: (limit?: number): Promise<IPCResult<unknown[]>> =>
      api.invoke(EXT_JOBS_IPC.ACTION_LOG_LIST, { limit }) as Promise<IPCResult<unknown[]>>
  },

  memory: {
    search: (query: string, category?: string, limit?: number): Promise<IPCResult<unknown[]>> =>
      api.invoke(EXT_JOBS_IPC.MEMORY_SEARCH, { query, category, limit }) as Promise<
        IPCResult<unknown[]>
      >,

    add: (
      category: string,
      content: string,
      source?: string,
      confidence?: number,
      metadata?: Record<string, unknown>
    ): Promise<IPCResult<unknown>> =>
      api.invoke(EXT_JOBS_IPC.MEMORY_ADD, {
        category,
        content,
        source,
        confidence,
        metadata
      }) as Promise<IPCResult<unknown>>,

    delete: (id: string): Promise<IPCResult> =>
      api.invoke(EXT_JOBS_IPC.MEMORY_DELETE, { id }) as Promise<IPCResult>,

    list: (category?: string, limit?: number): Promise<IPCResult<unknown[]>> =>
      api.invoke(EXT_JOBS_IPC.MEMORY_LIST, { category, limit }) as Promise<IPCResult<unknown[]>>
  }
}

// Re-export shell IPC methods that ext-jobs components need.
// These stay on the shell's channels (session:*, browser:*, etc.)
export { ipc as shellIpc } from '@renderer/lib/ipc-client'

export type { IPCResult }
