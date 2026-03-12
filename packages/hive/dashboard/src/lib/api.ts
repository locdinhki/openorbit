const TOKEN_KEY = 'hive_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

function getBaseUrl(): string {
  // In dev, proxy through vite. In prod, same origin.
  return ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers
    }
  })

  if (res.status === 401 || res.status === 403) {
    clearToken()
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return res.json()
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Device {
  id: string
  hardwareId: string
  name: string
  type: string
  status: string
  lastSeenAt: string | null
  ipAddress: string | null
  capabilities: unknown
  locationTag: string | null
  hardwareInfo: Record<string, unknown> | null
  minionVersion: string | null
  createdAt: string
  updatedAt: string
}

export interface MinionLatest {
  version: string
  downloadUrl: string
  checksum: string
}

export interface Task {
  id: string
  createdBy: string | null
  targetDevice: string | null
  priority: string
  status: string
  instruction: Record<string, unknown>
  dispatchedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface TaskResult {
  id: string
  taskId: string
  deviceId: string
  status: string
  result: Record<string, unknown> | null
  error: string | null
  durationMs: string | null
  createdAt: string
}

export interface TaskWithResults extends Task {
  results: TaskResult[]
}

export interface Schedule {
  id: string
  deviceId: string
  name: string
  instruction: Record<string, unknown>
  cronExpression: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
}

export interface WorkflowStep {
  name: string
  deviceId: string
  instruction: Record<string, unknown>
  onSuccess?: number | null
  onFailure?: number | null
  passOutputAs?: string
}

export interface Workflow {
  id: string
  name: string
  description: string | null
  steps: WorkflowStep[]
  createdAt: string
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  currentStep: number
  context: Record<string, string>
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface WorkflowStepRun {
  id: string
  runId: string
  stepIndex: number
  taskId: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  output: Record<string, unknown> | null
  error: string | null
  startedAt: string | null
  completedAt: string | null
}

export interface WorkflowRunDetail extends WorkflowRun {
  stepRuns: WorkflowStepRun[]
}

export interface DeviceGroup {
  id: string
  name: string
  description: string | null
  tagFilter: string
  memberCount?: number
  onlineCount?: number
  createdAt: string
}

export interface DeviceGroupDetail extends DeviceGroup {
  members: Device[]
}

export interface BroadcastResult {
  groupId: string
  taskCount: number
  tasks: Task[]
}

export interface DeviceMetric {
  id: string
  deviceId: string
  recordedAt: string
  cpuPercent: number | null
  memPercent: number | null
  memUsedMb: number | null
  memTotalMb: number | null
}

export interface AlertRule {
  id: string
  name: string
  deviceId: string | null
  metric: string
  threshold: number
  enabled: boolean
  createdAt: string
}

export interface Alert {
  id: string
  ruleId: string
  deviceId: string
  triggeredAt: string
  resolvedAt: string | null
  notified: boolean
  message: string | null
}

export interface TaskTemplate {
  id: string
  name: string
  description: string | null
  deviceId: string | null
  instruction: Record<string, unknown>
  createdAt: string
}

export interface WebhookDef {
  id: string
  name: string
  token: string
  action: string
  actionId: string
  deviceId: string | null
  createdAt: string
}

export interface WebhookCallEntry {
  id: string
  webhookId: string
  calledAt: string
  payload: Record<string, unknown> | null
  resultId: string | null
}

export interface TriggerDef {
  id: string
  name: string
  enabled: boolean
  condition: string
  conditionParams: Record<string, unknown> | null
  action: string
  actionParams: Record<string, unknown>
  cooldownS: number
  lastFiredAt: string | null
  createdAt: string
}

export interface TriggerRunEntry {
  id: string
  triggerId: string
  firedAt: string
  conditionData: Record<string, unknown> | null
  resultId: string | null
}

export interface HealthResponse {
  status: string
  uptime: number
}

// ── API methods ────────────────────────────────────────────────────────────

export const api = {
  health: () => request<HealthResponse>('/api/health'),

  listDevices: () => request<Device[]>('/api/devices'),

  getDevice: (id: string) => request<Device>(`/api/devices/${encodeURIComponent(id)}`),

  // Minion auto-update
  getMinionLatest: () => request<MinionLatest>('/minion/latest'),

  updateMinion: (deviceId: string) =>
    request<{ id: string }>(`/api/minion/update/${encodeURIComponent(deviceId)}`, {
      method: 'POST',
      body: '{}'
    }),

  updateAllMinions: () =>
    request<{ version: string; deviceCount: number; tasks: Task[] }>('/api/minion/update-all', {
      method: 'POST',
      body: '{}'
    }),

  listTasks: (params?: { status?: string; deviceId?: string; limit?: number }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.deviceId) q.set('deviceId', params.deviceId)
    if (params?.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return request<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`)
  },

  getTask: (id: string) => request<TaskWithResults>(`/api/tasks/${encodeURIComponent(id)}`),

  createTask: (body: {
    targetDevice: string
    instruction: Record<string, unknown>
    priority?: string
  }) => request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(body) }),

  // Schedules
  listSchedules: (params?: { deviceId?: string }) => {
    const q = new URLSearchParams()
    if (params?.deviceId) q.set('deviceId', params.deviceId)
    const qs = q.toString()
    return request<Schedule[]>(`/api/schedules${qs ? `?${qs}` : ''}`)
  },

  getSchedule: (id: string) => request<Schedule>(`/api/schedules/${encodeURIComponent(id)}`),

  createSchedule: (body: {
    deviceId: string
    name: string
    instruction: Record<string, unknown>
    cronExpression: string
  }) => request<Schedule>('/api/schedules', { method: 'POST', body: JSON.stringify(body) }),

  updateSchedule: (id: string, body: Record<string, unknown>) =>
    request<Schedule>(`/api/schedules/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body)
    }),

  deleteSchedule: (id: string) =>
    request<{ success: boolean }>(`/api/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Workflows
  listWorkflows: () => request<Workflow[]>('/api/workflows'),

  getWorkflow: (id: string) => request<Workflow>(`/api/workflows/${encodeURIComponent(id)}`),

  createWorkflow: (body: { name: string; description?: string; steps: WorkflowStep[] }) =>
    request<Workflow>('/api/workflows', { method: 'POST', body: JSON.stringify(body) }),

  deleteWorkflow: (id: string) =>
    request<{ success: boolean }>(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listWorkflowRuns: (workflowId: string) =>
    request<WorkflowRun[]>(`/api/workflows/${encodeURIComponent(workflowId)}/runs`),

  runWorkflow: (id: string) =>
    request<WorkflowRun>(`/api/workflows/${encodeURIComponent(id)}/run`, {
      method: 'POST',
      body: '{}'
    }),

  getWorkflowRunDetail: (runId: string) =>
    request<WorkflowRunDetail>(`/api/workflow-runs/${encodeURIComponent(runId)}`),

  // Groups
  listGroups: () => request<DeviceGroup[]>('/api/groups'),

  getGroup: (id: string) => request<DeviceGroupDetail>(`/api/groups/${encodeURIComponent(id)}`),

  createGroup: (body: { name: string; description?: string; tagFilter: string }) =>
    request<DeviceGroup>('/api/groups', { method: 'POST', body: JSON.stringify(body) }),

  deleteGroup: (id: string) =>
    request<{ success: boolean }>(`/api/groups/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  broadcast: (groupId: string, body: { instruction: Record<string, unknown>; priority?: string }) =>
    request<BroadcastResult>(`/api/groups/${encodeURIComponent(groupId)}/broadcast`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),

  // Monitoring
  getMetrics: (deviceId: string, limit = 60) =>
    request<DeviceMetric[]>(`/api/metrics/${encodeURIComponent(deviceId)}?limit=${limit}`),

  // Alert Rules
  listAlertRules: () => request<AlertRule[]>('/api/alert-rules'),

  createAlertRule: (body: { name: string; deviceId?: string; metric: string; threshold: number }) =>
    request<AlertRule>('/api/alert-rules', { method: 'POST', body: JSON.stringify(body) }),

  deleteAlertRule: (id: string) =>
    request<{ success: boolean }>(`/api/alert-rules/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),

  // Alerts
  listAlerts: (params?: { deviceId?: string; active?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.deviceId) q.set('deviceId', params.deviceId)
    if (params?.active) q.set('active', 'true')
    const qs = q.toString()
    return request<Alert[]>(`/api/alerts${qs ? `?${qs}` : ''}`)
  },

  resolveAlert: (id: string) =>
    request<{ success: boolean }>(`/api/alerts/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      body: '{}'
    }),

  // Task Templates
  listTemplates: () => request<TaskTemplate[]>('/api/templates'),

  createTemplate: (body: {
    name: string
    description?: string
    deviceId?: string
    instruction: Record<string, unknown>
  }) => request<TaskTemplate>('/api/templates', { method: 'POST', body: JSON.stringify(body) }),

  deleteTemplate: (id: string) =>
    request<{ success: boolean }>(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  runTemplate: (id: string, body?: { deviceId?: string }) =>
    request<Task>(`/api/templates/${encodeURIComponent(id)}/run`, {
      method: 'POST',
      body: JSON.stringify(body ?? {})
    }),

  // Webhooks
  listWebhooks: () => request<WebhookDef[]>('/api/webhooks'),

  createWebhook: (body: { name: string; action: string; actionId: string; deviceId?: string }) =>
    request<WebhookDef>('/api/webhooks', { method: 'POST', body: JSON.stringify(body) }),

  deleteWebhook: (id: string) =>
    request<{ success: boolean }>(`/api/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listWebhookCalls: (id: string) =>
    request<WebhookCallEntry[]>(`/api/webhooks/${encodeURIComponent(id)}/calls`),

  // Triggers
  listTriggers: () => request<TriggerDef[]>('/api/triggers'),

  createTrigger: (body: {
    name: string
    condition: string
    conditionParams?: Record<string, unknown>
    action: string
    actionParams: Record<string, unknown>
    cooldownS?: number
  }) => request<TriggerDef>('/api/triggers', { method: 'POST', body: JSON.stringify(body) }),

  updateTrigger: (id: string, body: { enabled?: boolean }) =>
    request<TriggerDef>(`/api/triggers/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),

  deleteTrigger: (id: string) =>
    request<{ success: boolean }>(`/api/triggers/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  listTriggerRuns: (id: string) =>
    request<TriggerRunEntry[]>(`/api/triggers/${encodeURIComponent(id)}/runs`),

  validateToken: async (token: string): Promise<boolean> => {
    try {
      const res = await fetch(`${getBaseUrl()}/api/health`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      // health endpoint doesn't require auth, so also try devices
      const devRes = await fetch(`${getBaseUrl()}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return devRes.ok
    } catch {
      return false
    }
  }
}
