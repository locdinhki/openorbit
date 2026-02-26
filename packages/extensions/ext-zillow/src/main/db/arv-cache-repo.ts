import { v4 as uuid } from 'uuid'
import type Database from 'better-sqlite3'

export interface ArvCacheRow {
  id: string
  address1: string
  city: string
  state: string
  postal_code: string
  zestimate: number | null
  zillow_url: string | null
  error: string | null
  scraped_at: string
}

export class ArvCacheRepo {
  constructor(private db: Database.Database) {}

  insert(data: {
    address1: string
    city: string
    state: string
    postalCode: string
    zestimate: number | null
    zillowUrl: string | null
    error?: string
  }): ArvCacheRow {
    const id = uuid()
    this.db
      .prepare(
        `INSERT INTO arv_cache (id, address1, city, state, postal_code, zestimate, zillow_url, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.address1,
        data.city,
        data.state,
        data.postalCode,
        data.zestimate,
        data.zillowUrl,
        data.error ?? null
      )

    return this.getById(id)!
  }

  getById(id: string): ArvCacheRow | null {
    return (
      (this.db.prepare('SELECT * FROM arv_cache WHERE id = ?').get(id) as
        | ArvCacheRow
        | undefined) ?? null
    )
  }

  findByAddress(
    address1: string,
    city: string,
    state: string,
    postalCode: string
  ): ArvCacheRow | null {
    return (
      (this.db
        .prepare(
          'SELECT * FROM arv_cache WHERE address1 = ? AND city = ? AND state = ? AND postal_code = ? ORDER BY scraped_at DESC LIMIT 1'
        )
        .get(address1, city, state, postalCode) as ArvCacheRow | undefined) ?? null
    )
  }

  list(limit = 100): ArvCacheRow[] {
    return this.db
      .prepare('SELECT * FROM arv_cache ORDER BY scraped_at DESC LIMIT ?')
      .all(limit) as ArvCacheRow[]
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM arv_cache WHERE id = ?').run(id)
  }

  purge(): number {
    const result = this.db.prepare('DELETE FROM arv_cache').run()
    return result.changes
  }
}
