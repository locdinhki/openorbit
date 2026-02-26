import { getDatabase } from './database'

export interface ApiUsageEntry {
  id: number
  apiKeyHash: string
  model: string
  task: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
  errorCode?: string
  createdAt: string
}

export interface ApiUsageSummary {
  model: string
  totalRequests: number
  totalInputTokens: number
  totalOutputTokens: number
  errorCount: number
  avgLatencyMs: number
}

interface UsageRow {
  id: number
  api_key_hash: string
  model: string
  task: string
  input_tokens: number
  output_tokens: number
  latency_ms: number
  success: number
  error_code: string | null
  created_at: string
}

interface SummaryRow {
  model: string
  total_requests: number
  total_input_tokens: number
  total_output_tokens: number
  error_count: number
  avg_latency_ms: number
}

function rowToEntry(row: UsageRow): ApiUsageEntry {
  return {
    id: row.id,
    apiKeyHash: row.api_key_hash,
    model: row.model,
    task: row.task,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    latencyMs: row.latency_ms,
    success: row.success === 1,
    errorCode: row.error_code ?? undefined,
    createdAt: row.created_at
  }
}

export class ApiUsageRepo {
  record(entry: {
    apiKeyHash: string
    model: string
    task: string
    inputTokens: number
    outputTokens: number
    latencyMs: number
    success: boolean
    errorCode?: string
  }): void {
    const db = getDatabase()
    db.prepare(
      `INSERT INTO api_usage (api_key_hash, model, task, input_tokens, output_tokens, latency_ms, success, error_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      entry.apiKeyHash,
      entry.model,
      entry.task,
      entry.inputTokens,
      entry.outputTokens,
      entry.latencyMs,
      entry.success ? 1 : 0,
      entry.errorCode ?? null
    )
  }

  getByKey(keyHash: string, since?: string): ApiUsageEntry[] {
    const db = getDatabase()
    if (since) {
      const rows = db
        .prepare(
          'SELECT * FROM api_usage WHERE api_key_hash = ? AND created_at >= ? ORDER BY created_at DESC'
        )
        .all(keyHash, since) as UsageRow[]
      return rows.map(rowToEntry)
    }
    const rows = db
      .prepare('SELECT * FROM api_usage WHERE api_key_hash = ? ORDER BY created_at DESC')
      .all(keyHash) as UsageRow[]
    return rows.map(rowToEntry)
  }

  getSummary(since?: string): ApiUsageSummary[] {
    const db = getDatabase()
    const whereClause = since ? 'WHERE created_at >= ?' : ''
    const params = since ? [since] : []

    const rows = db
      .prepare(
        `SELECT
          model,
          COUNT(*) as total_requests,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error_count,
          AVG(latency_ms) as avg_latency_ms
        FROM api_usage
        ${whereClause}
        GROUP BY model
        ORDER BY total_requests DESC`
      )
      .all(...params) as SummaryRow[]

    return rows.map((row) => ({
      model: row.model,
      totalRequests: row.total_requests,
      totalInputTokens: row.total_input_tokens,
      totalOutputTokens: row.total_output_tokens,
      errorCount: row.error_count,
      avgLatencyMs: Math.round(row.avg_latency_ms)
    }))
  }
}
