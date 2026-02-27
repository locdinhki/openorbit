# 13.1: DB Schema & Repo

**Effort:** Low | **Status:** Complete

## Background

Custom user-created skills need persistent storage. Shipped catalog skills track their installed state in the existing `settings` table (`skill.{id}.installed` = `'1'` or `'0'`), but custom skills need a dedicated table for their full content.

## Tasks

### V8 Migration
- [ ] Add V8 migration to `packages/core/src/db/database.ts`
  ```sql
  CREATE TABLE IF NOT EXISTS user_skills (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'utility',
    icon TEXT NOT NULL DEFAULT 'puzzle',
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  ```

### UserSkillsRepo
- [ ] Create `packages/core/src/skills/user-skills-repo.ts`
  - Constructor DI: accepts `Database.Database` (same pattern as other repos)
  - `list()` → all custom skills
  - `get(id)` → single skill or null
  - `create({ id, displayName, description, category, icon, content })` → insert row
  - `update(id, updates)` → partial update with `updated_at` timestamp
  - `delete(id)` → remove row

## Key Patterns

### Constructor DI (matches existing repos)

```typescript
export class UserSkillsRepo {
  constructor(private db: Database.Database) {}

  list(): UserSkill[] {
    return this.db.prepare('SELECT * FROM user_skills ORDER BY display_name').all() as UserSkill[]
  }
}
```

### ID Generation for Custom Skills

Custom skill IDs should be generated as `custom-{slugified-name}` to avoid collision with catalog skill IDs (e.g. `pdf-generation`, `spreadsheet`).
