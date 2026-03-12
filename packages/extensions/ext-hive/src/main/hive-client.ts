// ============================================================================
// ext-hive — HiveClient (typed REST wrapper for hive API)
// ============================================================================

import type { Device, Task, TaskWithResults, Instruction, Priority, Schedule } from './types'

export class HiveClient {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  // ── Devices ───────────────────────────────────────────────────────────────

  async listDevices(): Promise<Device[]> {
    return this.get<Device[]>('/api/devices')
  }

  async getDevice(id: string): Promise<Device> {
    return this.get<Device>(`/api/devices/${encodeURIComponent(id)}`)
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  async createTask(params: {
    targetDevice: string
    instruction: Instruction
    priority?: Priority
  }): Promise<Task> {
    return this.post<Task>('/api/tasks', params)
  }

  async getTask(id: string): Promise<TaskWithResults> {
    return this.get<TaskWithResults>(`/api/tasks/${encodeURIComponent(id)}`)
  }

  async listTasks(filter?: {
    deviceId?: string
    status?: string
    limit?: number
  }): Promise<Task[]> {
    const params = new URLSearchParams()
    if (filter?.deviceId) params.set('deviceId', filter.deviceId)
    if (filter?.status) params.set('status', filter.status)
    if (filter?.limit) params.set('limit', String(filter.limit))
    const qs = params.toString()
    return this.get<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`)
  }

  // ── Schedules ───────────────────────────────────────────────────────────

  async listSchedules(deviceId?: string): Promise<Schedule[]> {
    const qs = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''
    return this.get<Schedule[]>(`/api/schedules${qs}`)
  }

  async getSchedule(id: string): Promise<Schedule> {
    return this.get<Schedule>(`/api/schedules/${encodeURIComponent(id)}`)
  }

  async createSchedule(params: {
    deviceId: string
    name: string
    instruction: Record<string, unknown>
    cronExpression: string
  }): Promise<Schedule> {
    return this.post<Schedule>('/api/schedules', params)
  }

  async updateSchedule(id: string, updates: Record<string, unknown>): Promise<Schedule> {
    return this.put<Schedule>(`/api/schedules/${encodeURIComponent(id)}`, updates)
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.del(`/api/schedules/${encodeURIComponent(id)}`)
  }

  // ── Workflows ────────────────────────────────────────────────────────────

  async listWorkflows(): Promise<Record<string, unknown>[]> {
    return this.get<Record<string, unknown>[]>('/api/workflows')
  }

  async createWorkflow(params: {
    name: string
    description?: string
    steps: Record<string, unknown>[]
  }): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/api/workflows', params)
  }

  async runWorkflow(id: string): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>(`/api/workflows/${encodeURIComponent(id)}/run`, {})
  }

  async getWorkflowRunDetail(runId: string): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>(`/api/workflow-runs/${encodeURIComponent(runId)}`)
  }

  // ── Groups ───────────────────────────────────────────────────────────────

  async listGroups(): Promise<Record<string, unknown>[]> {
    return this.get<Record<string, unknown>[]>('/api/groups')
  }

  async createGroup(params: {
    name: string
    description?: string
    tagFilter: string
  }): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/api/groups', params)
  }

  async broadcastCommand(groupId: string, command: string): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>(
      `/api/groups/${encodeURIComponent(groupId)}/broadcast`,
      { instruction: { type: 'exec', command } }
    )
  }

  // ── Minion Updates ────────────────────────────────────────────────────────

  async getMinionLatest(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>('/minion/latest')
  }

  async updateMinion(deviceId: string): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>(
      `/api/minion/update/${encodeURIComponent(deviceId)}`,
      {}
    )
  }

  async updateAllMinions(): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/api/minion/update-all', {})
  }

  // ── Monitoring ────────────────────────────────────────────────────────────

  async getMetrics(deviceId: string, limit = 60): Promise<Record<string, unknown>[]> {
    return this.get<Record<string, unknown>[]>(
      `/api/metrics/${encodeURIComponent(deviceId)}?limit=${limit}`
    )
  }

  async listAlerts(params?: {
    deviceId?: string
    active?: boolean
  }): Promise<Record<string, unknown>[]> {
    const q = new URLSearchParams()
    if (params?.deviceId) q.set('deviceId', params.deviceId)
    if (params?.active) q.set('active', 'true')
    const qs = q.toString()
    return this.get<Record<string, unknown>[]>(`/api/alerts${qs ? `?${qs}` : ''}`)
  }

  // ── Terminal ─────────────────────────────────────────────────────────────

  getTerminalWsUrl(deviceId: string): string {
    const wsBase = this.baseUrl.replace(/^http/, 'ws')
    return `${wsBase}/api/pty/${encodeURIComponent(deviceId)}?token=${encodeURIComponent(this.apiKey)}`
  }

  // ── Task Templates ──────────────────────────────────────────────────────

  async listTemplates(): Promise<Record<string, unknown>[]> {
    return this.get<Record<string, unknown>[]>('/api/templates')
  }

  async createTemplate(params: {
    name: string
    description?: string
    deviceId?: string
    instruction: Record<string, unknown>
  }): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/api/templates', params)
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.del(`/api/templates/${encodeURIComponent(id)}`)
  }

  async runTemplate(id: string, params?: { deviceId?: string }): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>(
      `/api/templates/${encodeURIComponent(id)}/run`,
      params ?? {}
    )
  }

  // ── Triggers ──────────────────────────────────────────────────────────

  async listTriggers(): Promise<Record<string, unknown>[]> {
    return this.get<Record<string, unknown>[]>('/api/triggers')
  }

  async createTrigger(params: {
    name: string
    condition: string
    conditionParams?: Record<string, unknown>
    action: string
    actionParams: Record<string, unknown>
    cooldownS?: number
  }): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/api/triggers', params)
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async health(): Promise<{ status: string; uptime: number }> {
    return this.get<{ status: string; uptime: number }>('/api/health')
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.headers()
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Hive API ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Hive API ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers: { ...this.headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Hive API ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  private async del(path: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.headers()
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Hive API ${res.status}: ${text}`)
    }
  }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}` }
  }
}
