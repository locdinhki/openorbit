import { useState } from 'react'
import type { Filter } from '../../hooks/useTableData'
import { ipc } from '../../lib/ipc-client'

interface Props {
  table: string
  totalCount: number
  page: number
  pageSize: number
  filters: Filter[]
  onSetFilters: (filters: Filter[]) => void
  onRefresh: () => void
  onInsert?: () => void
  columns: string[]
}

const OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '!=' },
  { value: 'like', label: 'LIKE' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
  { value: 'gte', label: '>=' },
  { value: 'lte', label: '<=' },
  { value: 'is-null', label: 'IS NULL' },
  { value: 'not-null', label: 'NOT NULL' }
]

export default function DataToolbar({
  table,
  totalCount,
  filters,
  onSetFilters,
  onRefresh,
  onInsert,
  columns
}: Props): React.JSX.Element {
  const [showFilters, setShowFilters] = useState(false)
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | null>(null)

  const addFilter = (): void => {
    if (columns.length === 0) return
    onSetFilters([...filters, { column: columns[0], operator: 'eq', value: '' }])
    setShowFilters(true)
  }

  const removeFilter = (idx: number): void => {
    onSetFilters(filters.filter((_, i) => i !== idx))
  }

  const updateFilter = (idx: number, patch: Partial<Filter>): void => {
    onSetFilters(filters.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  }

  const handleExport = async (format: 'csv' | 'json'): Promise<void> => {
    setExportFormat(null)
    await ipc.io.exportTable(table, format)
  }

  return (
    <div className="border-b border-[var(--cos-border)]">
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--cos-text-muted)]">
            {totalCount.toLocaleString()} rows
          </span>
          <button
            onClick={addFilter}
            className="text-[10px] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer px-1.5 py-0.5 rounded hover:bg-[var(--cos-bg-hover)]"
          >
            + Filter
          </button>
          {filters.length > 0 && (
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-[10px] text-indigo-400 cursor-pointer"
            >
              {filters.length} filter{filters.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onInsert && (
            <button
              onClick={onInsert}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 cursor-pointer px-1.5 py-0.5 rounded hover:bg-[var(--cos-bg-hover)]"
            >
              + Insert
            </button>
          )}
          <div className="relative">
            <button
              onClick={() => setExportFormat(exportFormat ? null : 'csv')}
              className="text-[10px] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer px-1.5 py-0.5 rounded hover:bg-[var(--cos-bg-hover)]"
            >
              Export
            </button>
            {exportFormat !== null && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded shadow-lg z-20 py-1">
                <button
                  onClick={() => handleExport('csv')}
                  className="block w-full text-left px-3 py-1 text-xs text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-hover)] cursor-pointer"
                >
                  CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="block w-full text-left px-3 py-1 text-xs text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-hover)] cursor-pointer"
                >
                  JSON
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onRefresh}
            className="text-[10px] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer px-1.5 py-0.5 rounded hover:bg-[var(--cos-bg-hover)]"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter rows */}
      {showFilters && filters.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {filters.map((f, idx) => {
            const noValue = f.operator === 'is-null' || f.operator === 'not-null'
            return (
              <div key={idx} className="flex items-center gap-1">
                <select
                  value={f.column}
                  onChange={(e) => updateFilter(idx, { column: e.target.value })}
                  className="text-[10px] bg-[var(--cos-bg-secondary)] text-[var(--cos-text-secondary)] border border-[var(--cos-border)] rounded px-1 py-0.5"
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={f.operator}
                  onChange={(e) => updateFilter(idx, { operator: e.target.value })}
                  className="text-[10px] bg-[var(--cos-bg-secondary)] text-[var(--cos-text-secondary)] border border-[var(--cos-border)] rounded px-1 py-0.5"
                >
                  {OPERATORS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
                {!noValue && (
                  <input
                    value={f.value ?? ''}
                    onChange={(e) => updateFilter(idx, { value: e.target.value })}
                    placeholder="value"
                    className="text-[10px] bg-[var(--cos-bg-secondary)] text-[var(--cos-text-secondary)] border border-[var(--cos-border)] rounded px-1 py-0.5 flex-1 min-w-0"
                  />
                )}
                <button
                  onClick={() => removeFilter(idx)}
                  className="text-red-400 hover:text-red-300 cursor-pointer text-[10px] px-1"
                >
                  &#x2715;
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
