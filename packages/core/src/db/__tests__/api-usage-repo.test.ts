import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { createTestDatabase } from './test-db'

let testDb: Database.Database

vi.mock('../database', () => ({
  getDatabase: () => testDb,
  MIGRATION_V1_SQL: '',
  MIGRATION_V2_SQL: ''
}))

const { ApiUsageRepo } = await import('../api-usage-repo')

beforeEach(() => {
  testDb = createTestDatabase()
})

function makeEntry(overrides: Record<string, unknown> = {}): {
  apiKeyHash: string
  model: string
  task: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
  errorCode?: string
} {
  return {
    apiKeyHash: 'abc123def456',
    model: 'claude-sonnet-4-5-20250929',
    task: 'score_job',
    inputTokens: 500,
    outputTokens: 200,
    latencyMs: 1200,
    success: true,
    ...overrides
  }
}

describe('ApiUsageRepo', () => {
  let repo: InstanceType<typeof ApiUsageRepo>

  beforeEach(() => {
    repo = new ApiUsageRepo()
  })

  describe('record()', () => {
    it('inserts a usage entry', () => {
      repo.record(makeEntry())

      const rows = testDb.prepare('SELECT * FROM api_usage').all() as Record<string, unknown>[]
      expect(rows).toHaveLength(1)
      expect(rows[0].api_key_hash).toBe('abc123def456')
      expect(rows[0].model).toBe('claude-sonnet-4-5-20250929')
      expect(rows[0].input_tokens).toBe(500)
      expect(rows[0].output_tokens).toBe(200)
      expect(rows[0].success).toBe(1)
    })

    it('records error entries with error_code', () => {
      repo.record(makeEntry({ success: false, errorCode: 'RATE_LIMITED' }))

      const rows = testDb.prepare('SELECT * FROM api_usage').all() as Record<string, unknown>[]
      expect(rows[0].success).toBe(0)
      expect(rows[0].error_code).toBe('RATE_LIMITED')
    })

    it('stores null error_code for successful requests', () => {
      repo.record(makeEntry())

      const rows = testDb.prepare('SELECT * FROM api_usage').all() as Record<string, unknown>[]
      expect(rows[0].error_code).toBeNull()
    })
  })

  describe('getByKey()', () => {
    it('returns entries for a specific key hash', () => {
      repo.record(makeEntry({ apiKeyHash: 'key-aaa' }))
      repo.record(makeEntry({ apiKeyHash: 'key-bbb' }))
      repo.record(makeEntry({ apiKeyHash: 'key-aaa' }))

      const results = repo.getByKey('key-aaa')
      expect(results).toHaveLength(2)
      expect(results.every((r) => r.apiKeyHash === 'key-aaa')).toBe(true)
    })

    it('returns empty array for unknown key', () => {
      repo.record(makeEntry({ apiKeyHash: 'key-aaa' }))

      const results = repo.getByKey('key-zzz')
      expect(results).toHaveLength(0)
    })

    it('filters by since date', () => {
      // Insert directly with controlled timestamps
      testDb
        .prepare(
          `INSERT INTO api_usage (api_key_hash, model, task, input_tokens, output_tokens, latency_ms, success, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('key-aaa', 'sonnet', 'score_job', 100, 50, 500, 1, '2025-01-01T00:00:00')
      testDb
        .prepare(
          `INSERT INTO api_usage (api_key_hash, model, task, input_tokens, output_tokens, latency_ms, success, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('key-aaa', 'sonnet', 'score_job', 200, 100, 600, 1, '2025-06-15T00:00:00')

      const results = repo.getByKey('key-aaa', '2025-06-01T00:00:00')
      expect(results).toHaveLength(1)
      expect(results[0].inputTokens).toBe(200)
    })

    it('maps row fields to camelCase', () => {
      repo.record(makeEntry())

      const results = repo.getByKey('abc123def456')
      expect(results[0]).toHaveProperty('apiKeyHash')
      expect(results[0]).toHaveProperty('inputTokens')
      expect(results[0]).toHaveProperty('outputTokens')
      expect(results[0]).toHaveProperty('latencyMs')
      expect(results[0]).toHaveProperty('createdAt')
      expect(typeof results[0].success).toBe('boolean')
    })
  })

  describe('getSummary()', () => {
    it('aggregates by model', () => {
      repo.record(makeEntry({ model: 'sonnet', inputTokens: 100, outputTokens: 50 }))
      repo.record(makeEntry({ model: 'sonnet', inputTokens: 200, outputTokens: 100 }))
      repo.record(makeEntry({ model: 'opus', inputTokens: 500, outputTokens: 300 }))

      const summary = repo.getSummary()
      expect(summary).toHaveLength(2)

      const sonnet = summary.find((s) => s.model === 'sonnet')!
      expect(sonnet.totalRequests).toBe(2)
      expect(sonnet.totalInputTokens).toBe(300)
      expect(sonnet.totalOutputTokens).toBe(150)

      const opus = summary.find((s) => s.model === 'opus')!
      expect(opus.totalRequests).toBe(1)
      expect(opus.totalInputTokens).toBe(500)
    })

    it('counts errors', () => {
      repo.record(makeEntry({ model: 'sonnet', success: true }))
      repo.record(makeEntry({ model: 'sonnet', success: false, errorCode: 'TIMEOUT' }))
      repo.record(makeEntry({ model: 'sonnet', success: false, errorCode: 'RATE_LIMITED' }))

      const summary = repo.getSummary()
      expect(summary[0].errorCount).toBe(2)
    })

    it('returns empty array with no data', () => {
      const summary = repo.getSummary()
      expect(summary).toHaveLength(0)
    })

    it('filters by since date', () => {
      testDb
        .prepare(
          `INSERT INTO api_usage (api_key_hash, model, task, input_tokens, output_tokens, latency_ms, success, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('key', 'sonnet', 'score_job', 100, 50, 500, 1, '2025-01-01T00:00:00')
      testDb
        .prepare(
          `INSERT INTO api_usage (api_key_hash, model, task, input_tokens, output_tokens, latency_ms, success, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('key', 'sonnet', 'score_job', 200, 100, 600, 1, '2025-06-15T00:00:00')

      const summary = repo.getSummary('2025-06-01T00:00:00')
      expect(summary).toHaveLength(1)
      expect(summary[0].totalInputTokens).toBe(200)
    })
  })
})
