import type Database from 'better-sqlite3'
import type { Contact } from '../sdk/types'

export interface GhlContactRow {
  id: string
  location_id: string
  first_name: string | null
  last_name: string | null
  name: string | null
  email: string | null
  phone: string | null
  company_name: string | null
  address1: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  tags: string
  custom_fields: string
  raw: string
  synced_at: string
  created_at: string
}

export class GhlContactsRepo {
  constructor(private db: Database.Database) {}

  upsert(contact: Contact): void {
    this.db
      .prepare(
        `INSERT INTO ghl_contacts (id, location_id, first_name, last_name, name, email, phone, company_name, address1, city, state, postal_code, tags, custom_fields, raw, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           name = excluded.name,
           email = excluded.email,
           phone = excluded.phone,
           company_name = excluded.company_name,
           address1 = excluded.address1,
           city = excluded.city,
           state = excluded.state,
           postal_code = excluded.postal_code,
           tags = excluded.tags,
           custom_fields = excluded.custom_fields,
           raw = excluded.raw,
           synced_at = datetime('now')`
      )
      .run(
        contact.id,
        contact.locationId,
        contact.firstName ?? null,
        contact.lastName ?? null,
        contact.name ?? null,
        contact.email ?? null,
        contact.phone ?? null,
        contact.companyName ?? null,
        contact.address1 ?? null,
        contact.city ?? null,
        contact.state ?? null,
        contact.postalCode ?? null,
        JSON.stringify(contact.tags ?? []),
        JSON.stringify(contact.customFields ?? []),
        JSON.stringify(contact)
      )
  }

  getById(id: string): GhlContactRow | null {
    return (
      (this.db.prepare('SELECT * FROM ghl_contacts WHERE id = ?').get(id) as
        | GhlContactRow
        | undefined) ?? null
    )
  }

  list(opts?: { query?: string; limit?: number; offset?: number }): GhlContactRow[] {
    const limit = opts?.limit ?? 100
    const offset = opts?.offset ?? 0

    if (opts?.query) {
      const q = `%${opts.query}%`
      return this.db
        .prepare(
          `SELECT * FROM ghl_contacts
           WHERE name LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ? OR company_name LIKE ?
           ORDER BY synced_at DESC LIMIT ? OFFSET ?`
        )
        .all(q, q, q, q, q, q, limit, offset) as GhlContactRow[]
    }

    return this.db
      .prepare('SELECT * FROM ghl_contacts ORDER BY synced_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset) as GhlContactRow[]
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM ghl_contacts WHERE id = ?').run(id)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM ghl_contacts').get() as { cnt: number }
    return row.cnt
  }
}
