import type Database from 'better-sqlite3'
import type { Pipeline } from '../sdk/types'

export interface GhlPipelineRow {
  id: string
  location_id: string
  name: string
  stages: string
  synced_at: string
}

export class GhlPipelinesRepo {
  constructor(private db: Database.Database) {}

  upsert(pipeline: Pipeline): void {
    this.db
      .prepare(
        `INSERT INTO ghl_pipelines (id, location_id, name, stages, synced_at)
         VALUES (?, ?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           stages = excluded.stages,
           synced_at = datetime('now')`
      )
      .run(pipeline.id, pipeline.locationId, pipeline.name, JSON.stringify(pipeline.stages))
  }

  getById(id: string): GhlPipelineRow | null {
    return (
      (this.db.prepare('SELECT * FROM ghl_pipelines WHERE id = ?').get(id) as
        | GhlPipelineRow
        | undefined) ?? null
    )
  }

  list(): GhlPipelineRow[] {
    return this.db
      .prepare('SELECT * FROM ghl_pipelines ORDER BY name ASC')
      .all() as GhlPipelineRow[]
  }
}
