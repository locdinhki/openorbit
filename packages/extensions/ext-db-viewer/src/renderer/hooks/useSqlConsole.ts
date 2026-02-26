import { useState, useCallback } from 'react'
import { ipc } from '../lib/ipc-client'
import type { SqlExecuteResult } from '../../main/db/query-executor'

interface QueryHistoryEntry {
  sql: string
  timestamp: number
  statementType: string
}

export function useSqlConsole() {
  const [currentSql, setCurrentSql] = useState('')
  const [results, setResults] = useState<SqlExecuteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [history, setHistory] = useState<QueryHistoryEntry[]>([])

  const execute = useCallback(async (sql?: string) => {
    const query = sql ?? currentSql
    if (!query.trim()) return

    setIsExecuting(true)
    setError(null)
    setResults(null)

    const result = await ipc.sql.execute(query)

    if (result.success && result.data) {
      setResults(result.data)
      setHistory((prev) => [
        { sql: query, timestamp: Date.now(), statementType: result.data!.statementType },
        ...prev.slice(0, 49)
      ])
    } else {
      setError(result.error ?? 'Unknown error')
    }
    setIsExecuting(false)
  }, [currentSql])

  return {
    currentSql,
    setCurrentSql,
    results,
    error,
    isExecuting,
    history,
    execute
  }
}
