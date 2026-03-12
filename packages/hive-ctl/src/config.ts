import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { homedir } from 'node:os'

const CONFIG_DIR = resolve(homedir(), '.hive-ctl')
const CONFIG_FILE = resolve(CONFIG_DIR, 'config.json')

interface Config {
  url?: string
  apiKey?: string
}

function ensureDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

export function readConfig(): Config {
  // Env vars take precedence
  const envUrl = process.env.HIVE_URL
  const envKey = process.env.HIVE_API_KEY

  let fileConfig: Config = {}
  try {
    fileConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    // no config file
  }

  return {
    url: envUrl || fileConfig.url,
    apiKey: envKey || fileConfig.apiKey
  }
}

export function writeConfig(updates: Partial<Config>): void {
  ensureDir()
  const existing = readConfig()
  const merged = { ...existing, ...updates }
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + '\n')
}

export function getUrl(): string {
  const config = readConfig()
  if (!config.url) {
    console.error('Error: No Hive URL configured. Run: hive-ctl config set-url <url>')
    process.exit(1)
  }
  return config.url.replace(/\/$/, '')
}

export function getApiKey(): string {
  const config = readConfig()
  if (!config.apiKey) {
    console.error('Error: No API key configured. Run: hive-ctl config set-key <key>')
    process.exit(1)
  }
  return config.apiKey
}
