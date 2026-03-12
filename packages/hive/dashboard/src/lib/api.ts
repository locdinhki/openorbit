const TOKEN_KEY = 'hive_token'
const USER_KEY = 'hive_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export interface CurrentUser {
  id: string
  username: string
  role: string
}

export function getUser(): CurrentUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function setUser(user: CurrentUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function getBaseUrl(): string {
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

export interface HealthCheck {
  id: string
  deviceId: string
  name: string
  type: string
  url: string | null
  expectedStatus: number | null
  expectedBody: string | null
  command: string | null
  expectedExit: number | null
  runFrom: string
  intervalS: number
  timeoutS: number
  enabled: boolean
  lastStatus: string | null
  lastCheckedAt: string | null
  createdAt: string
}

export interface HealthCheckResult {
  id: string
  checkId: string
  status: string
  durationMs: number | null
  error: string | null
  checkedAt: string
}

export interface FleetReport {
  id: string
  generatedAt: string
  content: string
  periodStart: string
  periodEnd: string
}

export interface UserAccount {
  id: string
  username: string
  role: string
  createdAt: string
  lastLoginAt: string | null
}

export interface AuditEntry {
  id: string
  userId: string | null
  action: string
  targetId: string | null
  payload: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}

// ── API methods ────────────────────────────────────────────────────────────

export const api = {
  health: () => request<HealthResponse>('/api/health'),

  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; user: CurrentUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),

  me: () => request<{ user: CurrentUser }>('/api/auth/me'),

  // Users (admin only)
  listUsers: () => request<UserAccount[]>('/api/users'),

  createUser: (body: { username: string; password: string; role: string }) =>
    request<UserAccount>('/api/users', { method: 'POST', body: JSON.stringify(body) }),

  updateUser: (id: string, body: { role?: string; password?: string }) =>
    request<UserAccount>(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),

  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  // Audit log (admin only)
  listAuditLog: (params?: {
    userId?: string
    action?: string
    limit?: number
    offset?: number
  }) => {
    const q = new URLSearchParams()
    if (params?.userId) q.set('userId', params.userId)
    if (params?.action) q.set('action', params.action)
    if (params?.limit) q.set('limit', String(params.limit))
    if (params?.offset) q.set('offset', String(params.offset))
    const qs = q.toString()
    return request<AuditEntry[]>(`/api/audit-log${qs ? `?${qs}` : ''}`)
  },

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

  // Health Checks
  listHealthChecks: (params?: { deviceId?: string }) => {
    const q = new URLSearchParams()
    if (params?.deviceId) q.set('deviceId', params.deviceId)
    const qs = q.toString()
    return request<HealthCheck[]>(`/api/health-checks${qs ? `?${qs}` : ''}`)
  },

  createHealthCheck: (body: {
    deviceId: string
    name: string
    type: string
    url?: string
    command?: string
    runFrom?: string
    intervalS?: number
    timeoutS?: number
  }) => request<HealthCheck>('/api/health-checks', { method: 'POST', body: JSON.stringify(body) }),

  updateHealthCheck: (id: string, body: { enabled?: boolean; intervalS?: number }) =>
    request<HealthCheck>(`/api/health-checks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    }),

  deleteHealthCheck: (id: string) =>
    request<{ success: boolean }>(`/api/health-checks/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }),

  getHealthCheckResults: (id: string, limit = 20) =>
    request<HealthCheckResult[]>(
      `/api/health-checks/${encodeURIComponent(id)}/results?limit=${limit}`
    ),

  // Fleet Reports
  listReports: () => request<FleetReport[]>('/api/reports'),

  getReport: (id: string) => request<FleetReport>(`/api/reports/${encodeURIComponent(id)}`),

  generateReport: () =>
    request<FleetReport>('/api/reports/generate', { method: 'POST', body: '{}' }),

  // Legacy token validation (for backwards compat with API key login)
  validateToken: async (token: string): Promise<boolean> => {
    try {
      const devRes = await fetch(`${getBaseUrl()}/api/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return devRes.ok
    } catch {
      return false
    }
  }
}
