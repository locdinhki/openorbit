import { getDatabase } from './database'
import type { UserProfile } from '../types'

export class UserProfileRepo {
  get(): UserProfile | null {
    const db = getDatabase()
    const row = db.prepare('SELECT data FROM user_profile WHERE id = 1').get() as
      | { data: string }
      | undefined
    if (!row) return null
    const parsed = JSON.parse(row.data)
    if (!parsed.name) return null
    return parsed as UserProfile
  }

  save(profile: UserProfile): void {
    const db = getDatabase()
    db.prepare(
      `INSERT INTO user_profile (id, data) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET data = ?`
    ).run(JSON.stringify(profile), JSON.stringify(profile))
  }
}
