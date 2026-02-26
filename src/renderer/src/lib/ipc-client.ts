// ============================================================================
// OpenOrbit Shell — Renderer IPC Client (shell-only channels)
// Extension IPC clients live in their own packages.
// ============================================================================

import { IPC } from '@openorbit/core/ipc-channels'
import type {
  AICompletionResponse,
  AIProviderInfo,
  AIStreamChunk,
  ModelTier
} from '@openorbit/core/ai/provider-types'
import type { Schedule } from '@openorbit/core/db/schedules-repo'
import type { ScheduleRun } from '@openorbit/core/db/schedule-runs-repo'
import type { ToolMeta } from '@openorbit/core/automation/scheduler-types'

interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

const api = window.api

export const ipc = {
  session: {
    init: (): Promise<IPCResult<{ hasExistingSession: boolean }>> =>
      api.invoke(IPC.SESSION_INIT) as Promise<IPCResult<{ hasExistingSession: boolean }>>,

    status: (): Promise<{ initialized: boolean; hasExistingSession: boolean }> =>
      api.invoke(IPC.SESSION_STATUS) as Promise<{
        initialized: boolean
        hasExistingSession: boolean
      }>,

    login: (platform: string): Promise<IPCResult> =>
      api.invoke(IPC.SESSION_LOGIN, { platform }) as Promise<IPCResult>,

    save: (): Promise<IPCResult> => api.invoke(IPC.SESSION_SAVE) as Promise<IPCResult>,

    close: (): Promise<IPCResult> => api.invoke(IPC.SESSION_CLOSE) as Promise<IPCResult>
  },

  browser: {
    navigate: (url: string): Promise<IPCResult<{ url: string }>> =>
      api.invoke(IPC.BROWSER_NAVIGATE, { url }) as Promise<IPCResult<{ url: string }>>,

    screenshot: (): Promise<IPCResult<{ data: string }>> =>
      api.invoke(IPC.BROWSER_SCREENSHOT) as Promise<IPCResult<{ data: string }>>
  },

  settings: {
    get: (key: string): Promise<IPCResult<string | null>> =>
      api.invoke(IPC.SETTINGS_GET, { key }) as Promise<IPCResult<string | null>>,

    update: (key: string, value: string): Promise<IPCResult> =>
      api.invoke(IPC.SETTINGS_UPDATE, { key, value }) as Promise<IPCResult>,

    logPath: (): Promise<IPCResult<string | null>> =>
      api.invoke(IPC.SETTINGS_LOG_PATH) as Promise<IPCResult<string | null>>
  },

  screencast: {
    start: (opts?: {
      platform?: string
      quality?: number
      maxWidth?: number
      maxHeight?: number
      everyNthFrame?: number
    }): Promise<IPCResult> => api.invoke(IPC.SCREENCAST_START, opts ?? {}) as Promise<IPCResult>,

    stop: (platform?: string): Promise<IPCResult> =>
      api.invoke(IPC.SCREENCAST_STOP, { platform }) as Promise<IPCResult>
  },

  rpc: {
    getPairingInfo: (): Promise<IPCResult<{ wsUrl: string; token: string }>> =>
      api.invoke(IPC.RPC_PAIRING_INFO) as Promise<IPCResult<{ wsUrl: string; token: string }>>
  },

  ai: {
    providers: (): Promise<IPCResult<AIProviderInfo[]>> =>
      api.invoke(IPC.AI_PROVIDERS) as Promise<IPCResult<AIProviderInfo[]>>,

    setDefault: (providerId: string): Promise<IPCResult> =>
      api.invoke(IPC.AI_SET_DEFAULT, { providerId }) as Promise<IPCResult>,

    complete: (request: {
      systemPrompt: string
      userMessage: string
      tier?: ModelTier
      maxTokens?: number
      task?: string
      providerId?: string
    }): Promise<IPCResult<AICompletionResponse>> =>
      api.invoke(IPC.AI_COMPLETE, request) as Promise<IPCResult<AICompletionResponse>>,

    chat: (request: {
      systemPrompt: string
      messages: { role: 'user' | 'assistant'; content: string }[]
      tier?: ModelTier
      maxTokens?: number
      task?: string
      providerId?: string
    }): Promise<IPCResult<AICompletionResponse>> =>
      api.invoke(IPC.AI_CHAT, request) as Promise<IPCResult<AICompletionResponse>>,

    stream: (request: {
      systemPrompt: string
      userMessage: string
      tier?: ModelTier
      maxTokens?: number
      task?: string
      providerId?: string
    }): Promise<IPCResult<AICompletionResponse>> =>
      api.invoke(IPC.AI_STREAM, request) as Promise<IPCResult<AICompletionResponse>>,

    onStreamChunk: (callback: (chunk: AIStreamChunk) => void): (() => void) =>
      api.on(IPC.AI_STREAM_CHUNK, callback as (...args: unknown[]) => void)
  },

  schedules: {
    list: (): Promise<IPCResult<Schedule[]>> =>
      api.invoke(IPC.SCHEDULE_LIST) as Promise<IPCResult<Schedule[]>>,

    create: (input: {
      name: string
      taskType: string
      cronExpression: string
      enabled?: boolean
      config?: Record<string, unknown>
    }): Promise<IPCResult<Schedule>> =>
      api.invoke(IPC.SCHEDULE_CREATE, input) as Promise<IPCResult<Schedule>>,

    update: (
      id: string,
      updates: Partial<{
        name: string
        cronExpression: string
        enabled: boolean
        config: Record<string, unknown>
      }>
    ): Promise<IPCResult<Schedule>> =>
      api.invoke(IPC.SCHEDULE_UPDATE, { id, updates }) as Promise<IPCResult<Schedule>>,

    delete: (id: string): Promise<IPCResult> =>
      api.invoke(IPC.SCHEDULE_DELETE, { id }) as Promise<IPCResult>,

    toggle: (id: string, enabled: boolean): Promise<IPCResult<Schedule>> =>
      api.invoke(IPC.SCHEDULE_TOGGLE, { id, enabled }) as Promise<IPCResult<Schedule>>,

    trigger: (id: string): Promise<IPCResult> =>
      api.invoke(IPC.SCHEDULE_TRIGGER, { id }) as Promise<IPCResult>,

    runs: (
      scheduleId: string,
      limit?: number,
      offset?: number
    ): Promise<IPCResult<ScheduleRun[]>> =>
      api.invoke(IPC.SCHEDULE_RUNS, { scheduleId, limit, offset }) as Promise<
        IPCResult<ScheduleRun[]>
      >,

    onRunStart: (callback: (data: { scheduleId: string }) => void): (() => void) =>
      api.on(IPC.SCHEDULE_RUN_START, callback as (...args: unknown[]) => void),

    onRunComplete: (
      callback: (data: {
        scheduleId: string
        status: 'success' | 'error'
        error?: string
        durationMs: number
      }) => void
    ): (() => void) => api.on(IPC.SCHEDULE_RUN_COMPLETE, callback as (...args: unknown[]) => void)
  },

  scheduler: {
    tools: (): Promise<IPCResult<ToolMeta[]>> =>
      api.invoke(IPC.SCHEDULER_TOOLS) as Promise<IPCResult<ToolMeta[]>>
  }
}

export type { IPCResult }
