import type { ColumnInfo, IndexInfo } from '../../../main/db/schema-introspector'

interface Props {
  table: string
  columns: ColumnInfo[]
  primaryKey: string[]
  indexes: IndexInfo[]
}

export default function TableDetail({
  table: _table,
  columns,
  primaryKey,
  indexes
}: Props): React.JSX.Element {
  return (
    <div className="p-3 space-y-4">
      {/* Columns */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cos-text-muted)] mb-2">
          Columns ({columns.length})
        </h3>
        <div className="space-y-0.5">
          {columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center justify-between py-1 px-2 rounded text-xs hover:bg-[var(--cos-bg-hover)]"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {primaryKey.includes(col.name) && (
                  <span className="text-amber-400 text-[10px] shrink-0" title="Primary Key">
                    PK
                  </span>
                )}
                <span className="text-[var(--cos-text-primary)] truncate">{col.name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="text-[10px] text-indigo-400">{col.type || 'ANY'}</span>
                {col.notnull && (
                  <span className="text-[10px] text-red-400" title="NOT NULL">
                    NN
                  </span>
                )}
                {col.defaultValue !== null && (
                  <span
                    className="text-[10px] text-[var(--cos-text-muted)] max-w-[60px] truncate"
                    title={`Default: ${col.defaultValue}`}
                  >
                    ={col.defaultValue}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Indexes */}
      {indexes.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cos-text-muted)] mb-2">
            Indexes ({indexes.length})
          </h3>
          <div className="space-y-0.5">
            {indexes.map((idx) => (
              <div
                key={idx.name}
                className="py-1 px-2 rounded text-xs hover:bg-[var(--cos-bg-hover)]"
              >
                <div className="flex items-center gap-1.5">
                  {idx.unique && (
                    <span className="text-[10px] text-emerald-400" title="Unique">
                      U
                    </span>
                  )}
                  <span className="text-[var(--cos-text-secondary)] truncate">{idx.name}</span>
                </div>
                <div className="text-[10px] text-[var(--cos-text-muted)] ml-4">
                  {idx.columns.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
