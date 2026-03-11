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
  createdAt: string
  updatedAt: string
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

export interface HealthResponse {
  status: string
  uptime: number
}

// ── API methods ────────────────────────────────────────────────────────────

export const api = {
  health: () => request<HealthResponse>('/api/health'),

  listDevices: () => request<Device[]>('/api/devices'),

  getDevice: (id: string) => request<Device>(`/api/devices/${encodeURIComponent(id)}`),

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
