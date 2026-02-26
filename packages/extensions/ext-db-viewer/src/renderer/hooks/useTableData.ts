import { useState, useEffect, useCallback } from 'react'
import { ipc } from '../lib/ipc-client'

export interface Filter {
  column: string
  operator: string
  value?: string
}

interface TableDataHook {
  rows: Record<string, unknown>[]
  totalCount: number
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  pageSize: number
  setPageSize: React.Dispatch<React.SetStateAction<number>>
  sortColumn: string | undefined
  sortDirection: 'asc' | 'desc' | undefined
  toggleSort: (column: string) => void
  filters: Filter[]
  setFilters: React.Dispatch<React.SetStateAction<Filter[]>>
  loading: boolean
  refresh: () => Promise<void>
  totalPages: number
}

export function useTableData(table: string | null): TableDataHook {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortColumn, setSortColumn] = useState<string | undefined>()
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | undefined>()
  const [filters, setFilters] = useState<Filter[]>([])
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!table) {
      setRows([])
      setTotalCount(0)
      return
    }
    setLoading(true)
    const result = await ipc.data.query({
      table,
      page,
      pageSize,
      sortColumn,
      sortDirection,
      filters
    })
    if (result.success && result.data) {
      setRows(result.data.rows)
      setTotalCount(result.data.totalCount)
    }
    setLoading(false)
  }, [table, page, pageSize, sortColumn, sortDirection, filters])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch()
  }, [fetch])

  // Reset page when table or filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [table, filters])

  const toggleSort = useCallback(
    (column: string) => {
      if (sortColumn === column) {
        if (sortDirection === 'asc') setSortDirection('desc')
        else if (sortDirection === 'desc') {
          setSortColumn(undefined)
          setSortDirection(undefined)
        }
      } else {
        setSortColumn(column)
        setSortDirection('asc')
      }
    },
    [sortColumn, sortDirection]
  )

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return {
    rows,
    totalCount,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortColumn,
    sortDirection,
    toggleSort,
    filters,
    setFilters,
    loading,
    refresh: fetch,
    totalPages
  }
}
