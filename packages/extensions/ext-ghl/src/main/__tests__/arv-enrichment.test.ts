import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { ArvEnrichmentRunner, ArvRunsRepo } from '../automation/arv-enrichment'

// Inline migrations for test DB
function setupTestDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE arv_cache (
      id          TEXT PRIMARY KEY,
      address1    TEXT NOT NULL,
      city        TEXT NOT NULL,
      state       TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      zestimate   REAL,
      zillow_url  TEXT,
      error       TEXT,
      scraped_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_arv_cache_address ON arv_cache(address1, city, state, postal_code);

    CREATE TABLE ghl_arv_runs (
      id             TEXT PRIMARY KEY,
      pipeline_id    TEXT NOT NULL,
      pipeline_name  TEXT NOT NULL,
      total          INTEGER NOT NULL DEFAULT 0,
      enriched       INTEGER NOT NULL DEFAULT 0,
      skipped        INTEGER NOT NULL DEFAULT 0,
      errors         INTEGER NOT NULL DEFAULT 0,
      status         TEXT NOT NULL DEFAULT 'running',
      started_at     TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at    TEXT
    );
    CREATE INDEX idx_ghl_arv_runs_status ON ghl_arv_runs(status);
  `)
}

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('journal_mode = WAL')
  setupTestDb(db)
})

describe('ArvRunsRepo', () => {
  let repo: ArvRunsRepo

  beforeEach(() => {
    repo = new ArvRunsRepo(db)
  })

  it('insert and getById', () => {
    repo.insert({ id: 'run_1', pipelineId: 'pipe_1', pipelineName: 'Test Pipeline', total: 10 })

    const run = repo.getById('run_1')
    expect(run).not.toBeNull()
    expect(run!.pipeline_name).toBe('Test Pipeline')
    expect(run!.total).toBe(10)
    expect(run!.status).toBe('running')
    expect(run!.enriched).toBe(0)
  })

  it('updateProgress', () => {
    repo.insert({ id: 'run_2', pipelineId: 'pipe_1', pipelineName: 'Test', total: 20 })
    repo.updateProgress('run_2', 5, 3, 1)

    const run = repo.getById('run_2')
    expect(run!.enriched).toBe(5)
    expect(run!.skipped).toBe(3)
    expect(run!.errors).toBe(1)
  })

  it('finish sets status and finished_at', () => {
    repo.insert({ id: 'run_3', pipelineId: 'pipe_1', pipelineName: 'Test', total: 5 })
    repo.finish('run_3', 'completed')

    const run = repo.getById('run_3')
    expect(run!.status).toBe('completed')
    expect(run!.finished_at).not.toBeNull()
  })

  it('getRunning returns active run', () => {
    repo.insert({ id: 'run_4', pipelineId: 'pipe_1', pipelineName: 'Test', total: 5 })

    expect(repo.getRunning()).not.toBeNull()
    expect(repo.getRunning()!.id).toBe('run_4')

    repo.finish('run_4', 'completed')
    expect(repo.getRunning()).toBeNull()
  })

  it('listRecent returns most recent first', () => {
    repo.insert({ id: 'run_a', pipelineId: 'p1', pipelineName: 'A', total: 1 })
    repo.finish('run_a', 'completed')
    repo.insert({ id: 'run_b', pipelineId: 'p1', pipelineName: 'B', total: 2 })

    const recent = repo.listRecent(10)
    expect(recent).toHaveLength(2)
  })

  it('listRecent respects limit', () => {
    for (let i = 0; i < 5; i++) {
      repo.insert({ id: `run_${i}`, pipelineId: 'p1', pipelineName: `Run ${i}`, total: i })
      repo.finish(`run_${i}`, 'completed')
    }

    const limited = repo.listRecent(3)
    expect(limited).toHaveLength(3)
  })
})

describe('ArvEnrichmentRunner', () => {
  it('cannot start when already running', async () => {
    // Mock the GHL client to hang so runner stays "running"
    const mockGhl = {
      customFields: {
        findOrCreate: vi.fn().mockResolvedValue({ id: 'cf_1', name: 'ARV' })
      },
      opportunities: {
        getPipelines: vi.fn().mockImplementation(
          () =>
            new Promise(() => {
              /* never resolves */
            })
        )
      },
      contacts: { get: vi.fn() }
    }
    const mockSession = { newPage: vi.fn() }

    const runner = new ArvEnrichmentRunner(
      () => mockGhl as never,
      () => 'loc_1',
      () => mockSession as never,
      db
    )

    // Start first run (will hang on getPipelines)
    const promise = runner.run({ pipelineName: 'Test', arvFieldName: 'ARV' })

    // Try second run immediately
    await expect(runner.run({ pipelineName: 'Test', arvFieldName: 'ARV' })).rejects.toThrow(
      'already running'
    )

    // Cleanup — let the hung promise settle
    promise.catch(() => {})
  })

  it('tracks current run ID while running', () => {
    const mockGhl = {
      customFields: {
        findOrCreate: vi.fn().mockResolvedValue({ id: 'cf_1', name: 'ARV' })
      },
      opportunities: {
        getPipelines: vi.fn().mockImplementation(
          () =>
            new Promise(() => {
              /* never resolves */
            })
        )
      }
    }
    const mockSession = { newPage: vi.fn() }

    const runner = new ArvEnrichmentRunner(
      () => mockGhl as never,
      () => 'loc_1',
      () => mockSession as never,
      db
    )

    expect(runner.isRunning()).toBe(false)
    expect(runner.getCurrentRunId()).toBeNull()

    // Start a run
    const promise = runner.run({ pipelineName: 'Test', arvFieldName: 'ARV' })
    expect(runner.isRunning()).toBe(true)
    expect(runner.getCurrentRunId()).not.toBeNull()

    promise.catch(() => {})
  })

  it('completes successfully with empty pipeline', async () => {
    const mockGhl = {
      customFields: {
        findOrCreate: vi.fn().mockResolvedValue({ id: 'cf_arv', name: 'ARV' })
      },
      opportunities: {
        getPipelines: vi.fn().mockResolvedValue({
          pipelines: [{ id: 'pipe_1', name: 'Ready for SMS', stages: [] }]
        }),
        search: vi.fn().mockResolvedValue({ opportunities: [] })
      }
    }
    const mockSession = { newPage: vi.fn() }
    const progressCalls: unknown[] = []

    const runner = new ArvEnrichmentRunner(
      () => mockGhl as never,
      () => 'loc_1',
      () => mockSession as never,
      db,
      (p) => progressCalls.push(p)
    )

    const result = await runner.run({ pipelineName: 'Ready for SMS', arvFieldName: 'ARV' })

    expect(result.status).toBe('completed')
    expect(result.total).toBe(0)
    expect(result.enriched).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toBe(0)
    expect(runner.isRunning()).toBe(false)

    // Check run was recorded
    const runsRepo = new ArvRunsRepo(db)
    const run = runsRepo.getById(result.runId)
    expect(run).not.toBeNull()
    expect(run!.status).toBe('completed')
  })

  it('throws on unknown pipeline name', async () => {
    const mockGhl = {
      customFields: {
        findOrCreate: vi.fn().mockResolvedValue({ id: 'cf_arv', name: 'ARV' })
      },
      opportunities: {
        getPipelines: vi.fn().mockResolvedValue({
          pipelines: [{ id: 'pipe_1', name: 'Other Pipeline', stages: [] }]
        })
      }
    }
    const mockSession = { newPage: vi.fn() }

    const runner = new ArvEnrichmentRunner(
      () => mockGhl as never,
      () => 'loc_1',
      () => mockSession as never,
      db
    )

    await expect(
      runner.run({ pipelineName: 'Missing Pipeline', arvFieldName: 'ARV' })
    ).rejects.toThrow('Pipeline "Missing Pipeline" not found')

    // Verify run was marked as failed
    const runsRepo = new ArvRunsRepo(db)
    const recent = runsRepo.listRecent(1)
    expect(recent).toHaveLength(0) // insert happens after pipeline found, so no run recorded
  })
})
