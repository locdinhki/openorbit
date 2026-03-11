// ── Config ──────────────────────────────────────────────────────────────────

export interface MinionConfig {
  hiveUrl: string
  apiKey: string
  deviceName: string
  tags: string[]
  allowedOps: InstructionType[]
  workDir: string
  localApi: {
    enabled: boolean
    port: number
    bind: string
  }
  maxOutputBytes: number
}

// ── Instructions ────────────────────────────────────────────────────────────

export type InstructionType = 'exec' | 'read' | 'write' | 'upload' | 'download' | 'http'

export interface ExecInstruction {
  type: 'exec'
  command: string
  cwd?: string
  timeout?: number
  env?: Record<string, string>
}

export interface ReadInstruction {
  type: 'read'
  path: string
  encoding?: BufferEncoding
  maxBytes?: number
}

export interface WriteInstruction {
  type: 'write'
  path: string
  content: string
  mode?: string
}

export interface UploadInstruction {
  type: 'upload'
  localPath: string
  remotePath: string
}

export interface DownloadInstruction {
  type: 'download'
  url: string
  localPath: string
  mode?: string
}

export interface HttpInstruction {
  type: 'http'
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
  timeout?: number
}

export type Instruction =
  | ExecInstruction
  | ReadInstruction
  | WriteInstruction
  | UploadInstruction
  | DownloadInstruction
  | HttpInstruction

// ── Results ─────────────────────────────────────────────────────────────────

export interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
  durationMs: number
}

export interface ReadResult {
  content: string
}

export interface WriteResult {
  bytesWritten: number
}

export interface UploadResult {
  url: string
}

export interface DownloadResult {
  bytesDownloaded: number
}

export interface HttpResult {
  status: number
  headers: Record<string, string>
  body: string
}

export type InstructionResult =
  | ExecResult
  | ReadResult
  | WriteResult
  | UploadResult
  | DownloadResult
  | HttpResult

// ── Messages ────────────────────────────────────────────────────────────────

export interface InstructionMessage {
  messageId: string
  taskId: string
  instruction: Instruction
}

export interface ResultMessage {
  messageId: string
  taskId: string
  status: 'completed' | 'error'
  result?: InstructionResult
  error?: string
}

export interface HardwareInfo {
  hardwareId: string
  hostname: string
  platform: string
  arch: string
  kernel: string
  os: string
  cpu: { model: string; cores: number }
  memory: { totalMb: number; availableMb: number }
  storage: { totalGb: number; usedGb: number; freeGb: number }
  network: { ip: string; interface: string; mac: string }
  software: Record<string, string>
  uptimeSeconds: number
}
