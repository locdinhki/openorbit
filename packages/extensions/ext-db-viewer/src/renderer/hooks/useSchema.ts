import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../lib/ipc-client'
import type { TableInfo, ColumnInfo, IndexInfo } from '../../main/db/schema-introspector'

export function useSchema() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [columns, setColumns] = useState<ColumnInfo[]>([])
  const [primaryKey, setPrimaryKey] = useState<string[]>([])
  const [indexes, setIndexes] = useState<IndexInfo[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const result = await ipc.schema.tables()
    if (result.success && result.data) setTables(result.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!selectedTable) {
      setColumns([])
      setPrimaryKey([])
      setIndexes([])
      return
    }

    async function load(): Promise<void> {
      const [colResult, idxResult] = await Promise.all([
        ipc.schema.columns(selectedTable!),
        ipc.schema.indexes(selectedTable!)
      ])
      if (colResult.success && colResult.data) {
        setColumns(colResult.data.columns)
        setPrimaryKey(colResult.data.primaryKey)
      }
      if (idxResult.success && idxResult.data) setIndexes(idxResult.data)
    }
    load()
  }, [selectedTable])

  return { tables, selectedTable, setSelectedTable, columns, primaryKey, indexes, loading, refresh }
}
