import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { MinionConfig } from './types.js'

const DEFAULT_CONFIG_PATHS = [
  '/etc/hive-minion/config.json',
  resolve(process.env.HOME || '~', '.hive-minion/config.json'),
  resolve(process.cwd(), 'config.json')
]

const DEFAULT_CONFIG: MinionConfig = {
  hiveUrl: 'ws://localhost:8080',
  apiKey: '',
  deviceName: 'unnamed-minion',
  tags: [],
  allowedOps: ['exec', 'read', 'write', 'upload', 'download', 'http'],
  workDir: resolve(process.env.HOME || '~', 'hive-workspace'),
  localApi: {
    enabled: true,
    port: 18791,
    bind: '0.0.0.0'
  },
  maxOutputBytes: 10 * 1024 * 1024 // 10MB
}

export function loadConfig(explicitPath?: string): MinionConfig {
  // Explicit path from CLI arg takes priority
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      throw new Error(`Config file not found: ${explicitPath}`)
    }
    return parseConfig(readFileSync(explicitPath, 'utf-8'))
  }

  // Search default paths
  for (const p of DEFAULT_CONFIG_PATHS) {
    if (existsSync(p)) {
      console.log(`[config] Loaded from ${p}`)
      return parseConfig(readFileSync(p, 'utf-8'))
    }
  }

  console.log('[config] No config file found, using defaults')
  return { ...DEFAULT_CONFIG }
}

function parseConfig(raw: string): MinionConfig {
  const parsed = JSON.parse(raw)
  return {
    ...DEFAULT_CONFIG,
    ...parsed
  }
}
