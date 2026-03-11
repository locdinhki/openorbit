// ============================================================================
// ext-hive — Types (mirrors hive Drizzle schema, minus apiKeyHash)
// ============================================================================

export interface Device {
  id: string
  hardwareId: string | null
  name: string
  type: 'minion' | 'controller'
  capabilities: string[]
  locationTag: string | null
  status: 'online' | 'offline' | 'busy'
  lastSeenAt: string | null
  ipAddress: string | null
  hardwareInfo: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  createdBy: string | null
  targetDevice: string | null
  priority: 'low' | 'normal' | 'high' | 'critical'
  status: 'queued' | 'dispatched' | 'running' | 'completed' | 'failed' | 'timeout'
  instruction: Instruction
  dispatchedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface TaskResult {
  id: string
  taskId: string
  deviceId: string
  status: 'success' | 'error' | 'timeout'
  result: Record<string, unknown> | null
  error: string | null
  durationMs: number | null
  createdAt: string
}

export interface TaskWithResults extends Task {
  results: TaskResult[]
}

export type InstructionType = 'exec' | 'read' | 'write' | 'http'

export interface Instruction {
  type: InstructionType
  command?: string
  cwd?: string
  timeout?: number
  path?: string
  content?: string
  encoding?: string
  mode?: string
  method?: string
  url?: string
  headers?: Record<string, string>
  body?: string
}

export type Priority = 'low' | 'normal' | 'high' | 'critical'

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
