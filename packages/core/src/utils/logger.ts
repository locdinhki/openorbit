import { appendFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

let minLevel: LogLevel = 'info'
let logDir: string | null = null
let logFilePath: string | null = null
let isDev = false

const MAX_LOG_AGE_DAYS = 7

function getLogFileName(): string {
  const date = new Date().toISOString().split('T')[0]
  return `openorbit-${date}.log`
}

function formatJsonLine(level: LogLevel, context: string, message: string, data?: unknown): string {
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    ctx: context,
    msg: message
  }
  if (data !== undefined) {
    entry.data = data
  }
  return JSON.stringify(entry)
}

function formatConsole(level: LogLevel, context: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString()
  const base = `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`
  if (data !== undefined) {
    return `${base} ${JSON.stringify(data)}`
  }
  return base
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel]
}

function writeToFile(jsonLine: string): void {
  if (!logFilePath) return
  try {
    appendFileSync(logFilePath, jsonLine + '\n')
  } catch {
    // Silently fail — logging should never crash the app
  }
}

function pruneOldLogs(): void {
  if (!logDir) return
  try {
    const files = readdirSync(logDir)
    const cutoff = Date.now() - MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000

    for (const file of files) {
      if (!file.startsWith('openorbit-') || !file.endsWith('.log')) continue
      const dateStr = file.replace('openorbit-', '').replace('.log', '')
      const fileDate = new Date(dateStr).getTime()
      if (isNaN(fileDate)) continue
      if (fileDate < cutoff) {
        try {
          unlinkSync(join(logDir, file))
        } catch {
          // Ignore deletion failures
        }
      }
    }
  } catch {
    // Ignore pruning failures
  }
}

export function initLogger(dir: string, dev = false): void {
  logDir = dir
  isDev = dev

  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }

  logFilePath = join(logDir, getLogFileName())
  pruneOldLogs()
}

export function getLogPath(): string | null {
  return logFilePath
}

export function setLogLevel(level: LogLevel): void {
  minLevel = level
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createLogger(context: string) {
  function log(
    level: LogLevel,
    consoleFn: (...args: unknown[]) => void,
    message: string,
    data?: unknown
  ): void {
    if (!shouldLog(level)) return

    // Always write to file in production, always write to console in dev
    if (logFilePath) {
      writeToFile(formatJsonLine(level, context, message, data))
    }
    if (isDev || !logFilePath) {
      consoleFn(formatConsole(level, context, message, data))
    }
  }

  return {
    debug(message: string, data?: unknown): void {
      log('debug', console.debug, message, data)
    },
    info(message: string, data?: unknown): void {
      log('info', console.info, message, data)
    },
    warn(message: string, data?: unknown): void {
      log('warn', console.warn, message, data)
    },
    error(message: string, data?: unknown): void {
      log('error', console.error, message, data)
    }
  }
}
