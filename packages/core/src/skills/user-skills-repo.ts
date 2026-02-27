// ============================================================================
// OpenOrbit — User Skills Repository (custom user-created skills)
// ============================================================================

import type Database from 'better-sqlite3'
import type { SkillCategory } from './skill-types'

export interface UserSkill {
  id: string
  display_name: string
  description: string
  category: SkillCategory
  icon: string
  content: string
  created_at: string
  updated_at: string
}

export interface CreateUserSkillInput {
  displayName: string
  description: string
  category?: SkillCategory
  icon?: string
  content: string
}

export interface UpdateUserSkillInput {
  displayName?: string
  description?: string
  category?: SkillCategory
  icon?: string
  content?: string
}

export class UserSkillsRepo {
  constructor(private db: Database.Database) {}

  list(): UserSkill[] {
    return this.db.prepare('SELECT * FROM user_skills ORDER BY display_name').all() as UserSkill[]
  }

  get(id: string): UserSkill | null {
    return (
      (this.db.prepare('SELECT * FROM user_skills WHERE id = ?').get(id) as
        | UserSkill
        | undefined) ?? null
    )
  }

  create(input: CreateUserSkillInput): UserSkill {
    const id = 'custom-' + slugify(input.displayName)
    const category = input.category ?? 'utility'
    const icon = input.icon ?? 'sparkles'

    this.db
      .prepare(
        `INSERT INTO user_skills (id, display_name, description, category, icon, content)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.displayName, input.description, category, icon, input.content)

    return this.get(id)!
  }

  update(id: string, updates: UpdateUserSkillInput): UserSkill | null {
    const fields: string[] = []
    const values: unknown[] = []

    if (updates.displayName !== undefined) {
      fields.push('display_name = ?')
      values.push(updates.displayName)
    }
    if (updates.description !== undefined) {
      fields.push('description = ?')
      values.push(updates.description)
    }
    if (updates.category !== undefined) {
      fields.push('category = ?')
      values.push(updates.category)
    }
    if (updates.icon !== undefined) {
      fields.push('icon = ?')
      values.push(updates.icon)
    }
    if (updates.content !== undefined) {
      fields.push('content = ?')
      values.push(updates.content)
    }

    if (fields.length === 0) return this.get(id)

    fields.push("updated_at = datetime('now')")
    values.push(id)

    this.db.prepare(`UPDATE user_skills SET ${fields.join(', ')} WHERE id = ?`).run(...values)

    return this.get(id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM user_skills WHERE id = ?').run(id)
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
