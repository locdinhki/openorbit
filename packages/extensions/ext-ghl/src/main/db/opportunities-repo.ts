import type Database from 'better-sqlite3'
import type { Opportunity } from '../sdk/types'

export interface GhlOpportunityRow {
  id: string
  location_id: string
  name: string
  monetary_value: number | null
  pipeline_id: string
  pipeline_stage_id: string
  status: string
  contact_id: string
  assigned_to: string | null
  custom_fields: string
  raw: string
  synced_at: string
  created_at: string
}

export class GhlOpportunitiesRepo {
  constructor(private db: Database.Database) {}

  upsert(opp: Opportunity): void {
    this.db
      .prepare(
        `INSERT INTO ghl_opportunities (id, location_id, name, monetary_value, pipeline_id, pipeline_stage_id, status, contact_id, assigned_to, custom_fields, raw, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           monetary_value = excluded.monetary_value,
           pipeline_id = excluded.pipeline_id,
           pipeline_stage_id = excluded.pipeline_stage_id,
           status = excluded.status,
           contact_id = excluded.contact_id,
           assigned_to = excluded.assigned_to,
           custom_fields = excluded.custom_fields,
           raw = excluded.raw,
           synced_at = datetime('now')`
      )
      .run(
        opp.id,
        opp.locationId,
        opp.name,
        opp.monetaryValue ?? null,
        opp.pipelineId,
        opp.pipelineStageId,
        opp.status,
        opp.contactId,
        opp.assignedTo ?? null,
        JSON.stringify(opp.customFields ?? []),
        JSON.stringify(opp)
      )
  }

  getById(id: string): GhlOpportunityRow | null {
    return (
      (this.db.prepare('SELECT * FROM ghl_opportunities WHERE id = ?').get(id) as
        | GhlOpportunityRow
        | undefined) ?? null
    )
  }

  list(opts?: { pipelineId?: string; status?: string }): GhlOpportunityRow[] {
    const conditions: string[] = []
    const params: unknown[] = []

    if (opts?.pipelineId) {
      conditions.push('pipeline_id = ?')
      params.push(opts.pipelineId)
    }
    if (opts?.status) {
      conditions.push('status = ?')
      params.push(opts.status)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    return this.db
      .prepare(`SELECT * FROM ghl_opportunities ${where} ORDER BY synced_at DESC`)
      .all(...params) as GhlOpportunityRow[]
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM ghl_opportunities WHERE id = ?').run(id)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM ghl_opportunities').get() as {
      cnt: number
    }
    return row.cnt
  }
}
