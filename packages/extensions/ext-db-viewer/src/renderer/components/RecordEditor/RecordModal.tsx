import { useState } from 'react'
import type { ColumnInfo } from '../../../main/db/schema-introspector'

interface Props {
  table: string
  columns: ColumnInfo[]
  record: Record<string, unknown> | null // null = insert mode
  onSave: (values: Record<string, unknown>) => void
  onClose: () => void
}

export default function RecordModal({ table, columns, record, onSave, onClose }: Props): React.JSX.Element {
  const isEditing = record !== null
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const col of columns) {
      if (isEditing) {
        initial[col.name] = record[col.name] === null ? '' : String(record[col.name])
      } else {
        initial[col.name] = col.defaultValue ?? ''
      }
    }
    return initial
  })

  const handleSubmit = (): void => {
    const result: Record<string, unknown> = {}
    for (const col of columns) {
      const val = values[col.name]
      if (val === '') {
        result[col.name] = null
      } else if (col.type.toUpperCase().includes('INT') || col.type.toUpperCase() === 'REAL') {
        result[col.name] = Number(val)
      } else {
        result[col.name] = val
      }
    }
    onSave(result)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] rounded-lg shadow-xl w-[480px] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cos-border)]">
          <span className="text-sm font-medium text-[var(--cos-text-primary)]">
            {isEditing ? 'Edit Record' : 'Insert Record'} — {table}
          </span>
          <button
            onClick={onClose}
            className="text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer"
          >
            &#x2715;
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {columns.map((col) => (
            <div key={col.name}>
              <label className="flex items-center gap-1.5 text-xs text-[var(--cos-text-muted)] mb-1">
                <span className="text-[var(--cos-text-secondary)]">{col.name}</span>
                <span className="text-[10px] text-indigo-400">{col.type || 'ANY'}</span>
                {col.isPrimaryKey && <span className="text-[10px] text-amber-400">PK</span>}
                {col.notnull && <span className="text-[10px] text-red-400">NN</span>}
              </label>
              {col.type.toUpperCase() === 'TEXT' || col.type === '' ? (
                <textarea
                  value={values[col.name]}
                  onChange={(e) => setValues({ ...values, [col.name]: e.target.value })}
                  rows={values[col.name]?.includes('\n') ? 4 : 1}
                  className="w-full bg-[var(--cos-bg-secondary)] text-[var(--cos-text-primary)] border border-[var(--cos-border)] rounded px-2 py-1 text-xs outline-none focus:border-indigo-500 resize-y"
                />
              ) : (
                <input
                  type={
                    col.type.toUpperCase().includes('INT') || col.type.toUpperCase() === 'REAL'
                      ? 'number'
                      : 'text'
                  }
                  value={values[col.name]}
                  onChange={(e) => setValues({ ...values, [col.name]: e.target.value })}
                  className="w-full bg-[var(--cos-bg-secondary)] text-[var(--cos-text-primary)] border border-[var(--cos-border)] rounded px-2 py-1 text-xs outline-none focus:border-indigo-500"
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--cos-border)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] rounded cursor-pointer hover:bg-[var(--cos-bg-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-500 rounded cursor-pointer"
          >
            {isEditing ? 'Save Changes' : 'Insert'}
          </button>
        </div>
      </div>
    </div>
  )
}
