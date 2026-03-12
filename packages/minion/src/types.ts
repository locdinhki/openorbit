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

export type InstructionType =
  | 'exec'
  | 'read'
  | 'write'
  | 'upload'
  | 'download'
  | 'http'
  | 'self-update'
  | 'source-update'
  | 'pty'

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

export interface SelfUpdateInstruction {
  type: 'self-update'
  version: string // target version string
  downloadUrl: string // URL to download the new binary
  checksum: string // sha256 hex (or "sha256:<hex>")
}

export interface SourceUpdateInstruction {
  type: 'source-update'
  bundleUrl: string // URL to download tar.gz of minion source
  checksum?: string // optional SHA256 — if omitted, trust the X-Bundle-Hash header
}

export type Instruction =
  | ExecInstruction
  | ReadInstruction
  | WriteInstruction
  | UploadInstruction
  | DownloadInstruction
  | HttpInstruction
  | SelfUpdateInstruction
  | SourceUpdateInstruction

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

export interface SelfUpdateResult {
  updated: boolean
  version: string
  message: string
}

export interface SourceUpdateResult {
  updated: boolean
  message: string
}

export type InstructionResult =
  | ExecResult
  | ReadResult
  | WriteResult
  | UploadResult
  | DownloadResult
  | HttpResult
  | SelfUpdateResult
  | SourceUpdateResult

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

// ── PTY Messages ───────────────────────────────────────────────────────────

export interface PtyOpenMessage {
  type: 'pty-open'
  sessionId: string
  cols: number
  rows: number
  shell?: string
}

export interface PtyInputMessage {
  type: 'pty-input'
  sessionId: string
  data: string // base64-encoded keystrokes
}

export interface PtyResizeMessage {
  type: 'pty-resize'
  sessionId: string
  cols: number
  rows: number
}

export interface PtyCloseMessage {
  type: 'pty-close'
  sessionId: string
}

export interface PtyOutputMessage {
  type: 'pty-output'
  sessionId: string
  data: string // base64-encoded terminal output
}
