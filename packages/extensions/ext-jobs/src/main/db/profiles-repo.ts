import { v4 as uuid } from 'uuid'
import type Database from 'better-sqlite3'
import type { SearchProfile, PlatformName } from '@openorbit/core/types'

interface ProfileRow {
  id: string
  name: string
  enabled: number
  platform: string
  search_config: string
  application_config: string
  created_at: string
  updated_at: string
}

function rowToProfile(row: ProfileRow): SearchProfile {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled === 1,
    platform: row.platform as PlatformName,
    search: JSON.parse(row.search_config),
    application: JSON.parse(row.application_config),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ProfilesRepo {
  constructor(private db: Database.Database) {}

  insert(profile: Omit<SearchProfile, 'id' | 'createdAt' | 'updatedAt'>): SearchProfile {
    const id = uuid()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO search_profiles (id, name, enabled, platform, search_config, application_config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        profile.name,
        profile.enabled ? 1 : 0,
        profile.platform,
        JSON.stringify(profile.search),
        JSON.stringify(profile.application),
        now,
        now
      )

    return this.getById(id)!
  }

  getById(id: string): SearchProfile | null {
    const row = this.db.prepare('SELECT * FROM search_profiles WHERE id = ?').get(id) as
      | ProfileRow
      | undefined
    return row ? rowToProfile(row) : null
  }

  list(): SearchProfile[] {
    const rows = this.db
      .prepare('SELECT * FROM search_profiles ORDER BY created_at DESC')
      .all() as ProfileRow[]
    return rows.map(rowToProfile)
  }

  listEnabled(): SearchProfile[] {
    const rows = this.db
      .prepare('SELECT * FROM search_profiles WHERE enabled = 1 ORDER BY created_at DESC')
      .all() as ProfileRow[]
    return rows.map(rowToProfile)
  }

  update(
    id: string,
    updates: Partial<Omit<SearchProfile, 'id' | 'createdAt' | 'updatedAt'>>
  ): void {
    const sets: string[] = ['updated_at = ?']
    const params: unknown[] = [new Date().toISOString()]

    if (updates.name !== undefined) {
      sets.push('name = ?')
      params.push(updates.name)
    }
    if (updates.enabled !== undefined) {
      sets.push('enabled = ?')
      params.push(updates.enabled ? 1 : 0)
    }
    if (updates.platform !== undefined) {
      sets.push('platform = ?')
      params.push(updates.platform)
    }
    if (updates.search !== undefined) {
      sets.push('search_config = ?')
      params.push(JSON.stringify(updates.search))
    }
    if (updates.application !== undefined) {
      sets.push('application_config = ?')
      params.push(JSON.stringify(updates.application))
    }

    params.push(id)
    this.db.prepare(`UPDATE search_profiles SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM search_profiles WHERE id = ?').run(id)
  }

  toggleEnabled(id: string, enabled: boolean): void {
    this.db
      .prepare('UPDATE search_profiles SET enabled = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, new Date().toISOString(), id)
  }
}
