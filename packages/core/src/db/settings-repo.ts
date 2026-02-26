import { getDatabase } from './database'
import type { AutonomySettings } from '../types'
import { DEFAULT_AUTONOMY } from '../constants'

export class SettingsRepo {
  get(key: string): string | null {
    const db = getDatabase()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row?.value ?? null
  }

  set(key: string, value: string): void {
    const db = getDatabase()
    db.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = ?`
    ).run(key, value, value)
  }

  getAutonomy(): AutonomySettings {
    const raw = this.get('autonomy')
    if (!raw) return DEFAULT_AUTONOMY
    return { ...DEFAULT_AUTONOMY, ...JSON.parse(raw) }
  }

  setAutonomy(settings: AutonomySettings): void {
    this.set('autonomy', JSON.stringify(settings))
  }

  getApiKey(): string | null {
    return this.get('anthropic_api_key')
  }

  setApiKey(key: string): void {
    this.set('anthropic_api_key', key)
  }

  /** Get all configured API keys. Falls back to single key for backward compat. */
  getApiKeys(): string[] {
    const raw = this.get('anthropic_api_keys')
    if (raw) {
      try {
        const keys = JSON.parse(raw) as string[]
        if (Array.isArray(keys) && keys.length > 0) return keys
      } catch {
        // Fall through to single key
      }
    }
    const single = this.getApiKey()
    return single ? [single] : []
  }

  setApiKeys(keys: string[]): void {
    this.set('anthropic_api_keys', JSON.stringify(keys))
  }
}
