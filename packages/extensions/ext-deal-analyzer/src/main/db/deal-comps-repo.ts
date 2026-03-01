// ============================================================================
// ext-deal-analyzer — Deal Comps Repository
// ============================================================================

import type { Database } from 'better-sqlite3'
import { v4 as uuid } from 'uuid'

export interface DealCompRow {
  id: string
  dealId: string
  address: string
  city: string
  state: string
  postalCode: string
  salePrice: number
  saleDate: string | null
  squareFeet: number | null
  bedrooms: number | null
  bathrooms: number | null
  yearBuilt: number | null
  zillowUrl: string | null
  notes: string | null
  createdAt: string
}

export interface AddCompInput {
  dealId: string
  address: string
  city: string
  state: string
  postalCode: string
  salePrice: number
  saleDate?: string
  squareFeet?: number
  bedrooms?: number
  bathrooms?: number
  yearBuilt?: number
  zillowUrl?: string
  notes?: string
}

export class DealCompsRepo {
  constructor(private db: Database) {}

  list(dealId: string): DealCompRow[] {
    return this.db
      .prepare(
        `
        SELECT
          id, deal_id as dealId, address, city, state, postal_code as postalCode,
          sale_price as salePrice, sale_date as saleDate, square_feet as squareFeet,
          bedrooms, bathrooms, year_built as yearBuilt, zillow_url as zillowUrl,
          notes, created_at as createdAt
        FROM deal_comps
        WHERE deal_id = ?
        ORDER BY sale_date DESC, created_at DESC
      `
      )
      .all(dealId) as DealCompRow[]
  }

  add(input: AddCompInput): DealCompRow {
    const id = uuid()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
        INSERT INTO deal_comps (
          id, deal_id, address, city, state, postal_code,
          sale_price, sale_date, square_feet, bedrooms, bathrooms,
          year_built, zillow_url, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .run(
        id,
        input.dealId,
        input.address,
        input.city,
        input.state,
        input.postalCode,
        input.salePrice,
        input.saleDate ?? null,
        input.squareFeet ?? null,
        input.bedrooms ?? null,
        input.bathrooms ?? null,
        input.yearBuilt ?? null,
        input.zillowUrl ?? null,
        input.notes ?? null,
        now
      )

    return this.db
      .prepare(
        `
        SELECT
          id, deal_id as dealId, address, city, state, postal_code as postalCode,
          sale_price as salePrice, sale_date as saleDate, square_feet as squareFeet,
          bedrooms, bathrooms, year_built as yearBuilt, zillow_url as zillowUrl,
          notes, created_at as createdAt
        FROM deal_comps WHERE id = ?
      `
      )
      .get(id) as DealCompRow
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM deal_comps WHERE id = ?').run(id)
    return result.changes > 0
  }

  getAveragePrice(dealId: string): number | null {
    const row = this.db
      .prepare('SELECT AVG(sale_price) as avg FROM deal_comps WHERE deal_id = ?')
      .get(dealId) as { avg: number | null }
    return row?.avg ?? null
  }
}
