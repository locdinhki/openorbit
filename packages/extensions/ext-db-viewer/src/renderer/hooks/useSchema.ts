import { useEffect, useCallback } from 'react'
import { create } from 'zustand'
import { ipc } from '../lib/ipc-client'
import type { TableInfo, ColumnInfo, IndexInfo } from '../../main/db/schema-introspector'

interface SchemaState {
  tables: TableInfo[]
  selectedTable: string | null
  columns: ColumnInfo[]
  primaryKey: string[]
  indexes: IndexInfo[]
  loading: boolean
  setTables: (tables: TableInfo[]) => void
  setSelectedTable: (table: string | null) => void
  setColumns: (columns: ColumnInfo[]) => void
  setPrimaryKey: (pk: string[]) => void
  setIndexes: (indexes: IndexInfo[]) => void
  setLoading: (loading: boolean) => void
}

const useSchemaStore = create<SchemaState>()((set) => ({
  tables: [],
  selectedTable: null,
  columns: [],
  primaryKey: [],
  indexes: [],
  loading: false,
  setTables: (tables) => set({ tables }),
  setSelectedTable: (selectedTable) => set({ selectedTable }),
  setColumns: (columns) => set({ columns }),
  setPrimaryKey: (primaryKey) => set({ primaryKey }),
  setIndexes: (indexes) => set({ indexes }),
  setLoading: (loading) => set({ loading })
}))

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useSchema() {
  const store = useSchemaStore()

  const refresh = useCallback(async () => {
    useSchemaStore.getState().setLoading(true)
    const result = await ipc.schema.tables()
    if (result.success && result.data) useSchemaStore.getState().setTables(result.data)
    useSchemaStore.getState().setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!store.selectedTable) {
      store.setColumns([])
      store.setPrimaryKey([])
      store.setIndexes([])
      return
    }

    const table = store.selectedTable
    async function load(): Promise<void> {
      const [colResult, idxResult] = await Promise.all([
        ipc.schema.columns(table),
        ipc.schema.indexes(table)
      ])
      if (colResult.success && colResult.data) {
        useSchemaStore.getState().setColumns(colResult.data.columns)
        useSchemaStore.getState().setPrimaryKey(colResult.data.primaryKey)
      }
      if (idxResult.success && idxResult.data) useSchemaStore.getState().setIndexes(idxResult.data)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.selectedTable])

  return { ...store, refresh }
}
