import { useState } from 'react'
import type { ColumnInfo } from '../../../main/db/schema-introspector'
import CellRenderer from './CellRenderer'

interface Props {
  rows: Record<string, unknown>[]
  columns: ColumnInfo[]
  primaryKey: string[]
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
  onToggleSort: (column: string) => void
  onCellEdit?: (row: Record<string, unknown>, column: string, value: unknown) => void
  onDelete?: (row: Record<string, unknown>) => void
  onRowClick?: (row: Record<string, unknown>) => void
  loading: boolean
}

export default function DataTable({
  rows,
  columns,
  primaryKey,
  sortColumn,
  sortDirection,
  onToggleSort,
  onCellEdit,
  onDelete,
  onRowClick,
  loading
}: Props): React.JSX.Element {
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)] text-xs">
        Loading...
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)] text-xs">
        No data
      </div>
    )
  }

  const colNames = columns.map((c) => c.name)

  const handleDoubleClick = (rowIdx: number, col: string, value: unknown): void => {
    if (!onCellEdit) return
    setEditingCell({ rowIdx, col })
    setEditValue(value === null ? '' : String(value))
  }

  const commitEdit = (rowIdx: number, col: string): void => {
    if (!onCellEdit || !editingCell) return
    const row = rows[rowIdx]
    const original = row[col]
    const newVal = editValue === '' ? null : editValue
    if (String(original ?? '') !== String(newVal ?? '')) {
      onCellEdit(row, col, newVal)
    }
    setEditingCell(null)
  }

  const cancelEdit = (): void => {
    setEditingCell(null)
  }

  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 z-10">
        <tr className="bg-[var(--cos-bg-secondary)]">
          {onDelete && <th className="w-8" />}
          {colNames.map((col) => {
            const isSorted = sortColumn === col
            return (
              <th
                key={col}
                onClick={() => onToggleSort(col)}
                className="px-2 py-1.5 text-left font-medium text-[var(--cos-text-muted)] border-b border-[var(--cos-border)] cursor-pointer hover:text-[var(--cos-text-primary)] select-none whitespace-nowrap"
              >
                <span className="flex items-center gap-1">
                  {primaryKey.includes(col) && <span className="text-amber-400">PK</span>}
                  {col}
                  {isSorted && (
                    <span className="text-indigo-400">
                      {sortDirection === 'asc' ? '\u25B2' : '\u25BC'}
                    </span>
                  )}
                </span>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr
            key={rowIdx}
            className={`${
              rowIdx % 2 === 0 ? 'bg-[var(--cos-bg-primary)]' : 'bg-[var(--cos-bg-secondary)]/30'
            } hover:bg-[var(--cos-bg-hover)] ${onRowClick ? 'cursor-pointer' : ''}`}
          >
            {onDelete && (
              <td className="px-1 py-1 text-center border-b border-[var(--cos-border)]/30">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Delete this record?')) onDelete(row)
                  }}
                  className="text-red-400 hover:text-red-300 cursor-pointer text-[10px]"
                  title="Delete"
                >
                  &#x2715;
                </button>
              </td>
            )}
            {colNames.map((col) => {
              const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.col === col
              return (
                <td
                  key={col}
                  className="px-2 py-1 border-b border-[var(--cos-border)]/30 max-w-[300px]"
                  onDoubleClick={() => handleDoubleClick(rowIdx, col, row[col])}
                  onClick={() => !isEditing && onRowClick?.(row)}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => commitEdit(rowIdx, col)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit(rowIdx, col)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="w-full bg-[var(--cos-bg-primary)] text-[var(--cos-text-primary)] border border-indigo-500 rounded px-1 py-0.5 text-xs outline-none"
                    />
                  ) : (
                    <CellRenderer value={row[col]} />
                  )}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
