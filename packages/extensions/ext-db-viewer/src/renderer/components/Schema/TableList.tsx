import type { TableInfo } from '../../../main/db/schema-introspector'

interface Props {
  tables: TableInfo[]
  selectedTable: string | null
  onSelectTable: (name: string) => void
  loading: boolean
}

export default function TableList({
  tables,
  selectedTable,
  onSelectTable,
  loading
}: Props): React.JSX.Element {
  if (loading) {
    return <div className="p-3 text-xs text-[var(--cos-text-muted)]">Loading tables...</div>
  }

  if (tables.length === 0) {
    return <div className="p-3 text-xs text-[var(--cos-text-muted)]">No tables found</div>
  }

  const regular = tables.filter((t) => !t.isSystem && t.type !== 'virtual')
  const system = tables.filter((t) => t.isSystem)
  const virtual = tables.filter((t) => t.type === 'virtual')

  return (
    <div className="py-1">
      {regular.length > 0 && (
        <TableGroup
          label="Tables"
          tables={regular}
          selected={selectedTable}
          onSelect={onSelectTable}
        />
      )}
      {virtual.length > 0 && (
        <TableGroup
          label="Virtual Tables"
          tables={virtual}
          selected={selectedTable}
          onSelect={onSelectTable}
        />
      )}
      {system.length > 0 && (
        <TableGroup
          label="System"
          tables={system}
          selected={selectedTable}
          onSelect={onSelectTable}
        />
      )}
    </div>
  )
}

function TableGroup({
  label,
  tables,
  selected,
  onSelect
}: {
  label: string
  tables: TableInfo[]
  selected: string | null
  onSelect: (name: string) => void
}): React.JSX.Element {
  return (
    <div className="mb-1">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--cos-text-muted)]">
        {label}
      </div>
      {tables.map((t) => (
        <button
          key={t.name}
          onClick={() => onSelect(t.name)}
          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs cursor-pointer transition-colors ${
            selected === t.name
              ? 'bg-indigo-500/15 text-indigo-400'
              : 'text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-hover)]'
          }`}
        >
          <span className="flex items-center gap-1.5 truncate">
            {t.type === 'virtual' && (
              <span className="text-[10px] text-amber-400" title="Virtual table (read-only)">
                V
              </span>
            )}
            {t.isSystem && (
              <span className="text-[10px] text-[var(--cos-text-muted)]" title="System table">
                S
              </span>
            )}
            <span className="truncate">{t.name}</span>
          </span>
          <span className="text-[10px] text-[var(--cos-text-muted)] ml-2 shrink-0">
            {t.rowCount.toLocaleString()}
          </span>
        </button>
      ))}
    </div>
  )
}
