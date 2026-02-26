import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { GhlOpportunitiesRepo } from '../opportunities-repo'
import type { Opportunity } from '../../sdk/types'

let db: Database.Database
let repo: GhlOpportunitiesRepo

function makeOpp(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp_' + Math.random().toString(36).slice(2, 8),
    locationId: 'loc_001',
    name: 'Test Deal',
    monetaryValue: 50000,
    pipelineId: 'pipe_1',
    pipelineStageId: 'stage_1',
    status: 'open',
    contactId: 'ct_001',
    assignedTo: 'user_001',
    customFields: [],
    ...overrides
  }
}

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE ghl_opportunities (
      id                TEXT PRIMARY KEY,
      location_id       TEXT NOT NULL,
      name              TEXT NOT NULL,
      monetary_value    REAL,
      pipeline_id       TEXT NOT NULL,
      pipeline_stage_id TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'open',
      contact_id        TEXT NOT NULL,
      assigned_to       TEXT,
      custom_fields     TEXT NOT NULL DEFAULT '[]',
      raw               TEXT NOT NULL DEFAULT '{}',
      synced_at         TEXT NOT NULL DEFAULT (datetime('now')),
      created_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_ghl_opps_pipeline ON ghl_opportunities(pipeline_id);
    CREATE INDEX idx_ghl_opps_contact  ON ghl_opportunities(contact_id);
    CREATE INDEX idx_ghl_opps_status   ON ghl_opportunities(status);
  `)
  repo = new GhlOpportunitiesRepo(db)
})

describe('GhlOpportunitiesRepo', () => {
  it('upsert and getById', () => {
    const opp = makeOpp({ id: 'opp_test1' })
    repo.upsert(opp)

    const row = repo.getById('opp_test1')
    expect(row).not.toBeNull()
    expect(row!.name).toBe('Test Deal')
    expect(row!.monetary_value).toBe(50000)
    expect(row!.status).toBe('open')
  })

  it('upsert updates existing opportunity', () => {
    const opp = makeOpp({ id: 'opp_upd' })
    repo.upsert(opp)

    repo.upsert({ ...opp, name: 'Updated Deal', monetaryValue: 75000, status: 'won' })

    const row = repo.getById('opp_upd')
    expect(row!.name).toBe('Updated Deal')
    expect(row!.monetary_value).toBe(75000)
    expect(row!.status).toBe('won')
  })

  it('getById returns null for non-existent', () => {
    expect(repo.getById('opp_missing')).toBeNull()
  })

  it('list returns all opportunities', () => {
    repo.upsert(makeOpp({ id: 'opp_1' }))
    repo.upsert(makeOpp({ id: 'opp_2' }))
    repo.upsert(makeOpp({ id: 'opp_3' }))

    const all = repo.list()
    expect(all).toHaveLength(3)
  })

  it('list filters by pipelineId', () => {
    repo.upsert(makeOpp({ id: 'opp_a', pipelineId: 'pipe_A' }))
    repo.upsert(makeOpp({ id: 'opp_b', pipelineId: 'pipe_B' }))
    repo.upsert(makeOpp({ id: 'opp_c', pipelineId: 'pipe_A' }))

    const filtered = repo.list({ pipelineId: 'pipe_A' })
    expect(filtered).toHaveLength(2)
    expect(filtered.every((o) => o.pipeline_id === 'pipe_A')).toBe(true)
  })

  it('list filters by status', () => {
    repo.upsert(makeOpp({ id: 'opp_open', status: 'open' }))
    repo.upsert(makeOpp({ id: 'opp_won', status: 'won' }))
    repo.upsert(makeOpp({ id: 'opp_lost', status: 'lost' }))

    const won = repo.list({ status: 'won' })
    expect(won).toHaveLength(1)
    expect(won[0].status).toBe('won')
  })

  it('list filters by pipelineId and status combined', () => {
    repo.upsert(makeOpp({ id: 'o1', pipelineId: 'p1', status: 'open' }))
    repo.upsert(makeOpp({ id: 'o2', pipelineId: 'p1', status: 'won' }))
    repo.upsert(makeOpp({ id: 'o3', pipelineId: 'p2', status: 'open' }))

    const results = repo.list({ pipelineId: 'p1', status: 'open' })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('o1')
  })

  it('delete removes opportunity', () => {
    repo.upsert(makeOpp({ id: 'opp_del' }))
    expect(repo.getById('opp_del')).not.toBeNull()

    repo.delete('opp_del')
    expect(repo.getById('opp_del')).toBeNull()
  })

  it('count returns total', () => {
    expect(repo.count()).toBe(0)

    repo.upsert(makeOpp({ id: 'opp_1' }))
    repo.upsert(makeOpp({ id: 'opp_2' }))
    expect(repo.count()).toBe(2)
  })

  it('stores custom fields as JSON', () => {
    repo.upsert(
      makeOpp({
        id: 'opp_cf',
        customFields: [{ id: 'cf_source', value: 'web' }]
      })
    )

    const row = repo.getById('opp_cf')
    const fields = JSON.parse(row!.custom_fields)
    expect(fields).toHaveLength(1)
    expect(fields[0].value).toBe('web')
  })

  it('handles null monetary value', () => {
    repo.upsert(makeOpp({ id: 'opp_null', monetaryValue: undefined }))

    const row = repo.getById('opp_null')
    expect(row!.monetary_value).toBeNull()
  })
})
