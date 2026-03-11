import type { WebSocket } from 'ws'

// ── Enums (used by store and routes) ─────────────────────────────────────────

export type TaskStatus = 'queued' | 'dispatched' | 'running' | 'completed' | 'failed' | 'timeout'
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical'

// ── Connections (in-memory only) ─────────────────────────────────────────────

export interface ConnectedMinion {
  deviceId: string
  ws: WebSocket
  lastHeartbeat: Date
}

// ── WebSocket messages ──────────────────────────────────────────────────────

export interface AuthMessage {
  type: 'auth'
  apiKey: string
  hardwareId: string
  deviceInfo?: Record<string, unknown>
}

export interface InstructionMessage {
  messageId: string
  taskId: string
  instruction: Record<string, unknown>
}

export interface ResultMessage {
  messageId: string
  taskId: string
  status: 'completed' | 'error'
  result?: Record<string, unknown>
  error?: string
}

export interface HeartbeatMessage {
  type: 'heartbeat'
  timestamp: number
}

export interface HeartbeatAckMessage {
  type: 'heartbeat-ack'
  pendingTasks: number
}
