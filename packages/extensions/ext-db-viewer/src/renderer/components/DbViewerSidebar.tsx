import { useState } from 'react'
import { useSchema } from '../hooks/useSchema'
import { useDevMode } from '../hooks/useDevMode'
import TableList from './Schema/TableList'
import TableDetail from './Schema/TableDetail'

export default function DbViewerSidebar(): React.JSX.Element {
  const schema = useSchema()
  const devMode = useDevMode()
  const [view, setView] = useState<'list' | 'detail'>('list')

  const handleSelectTable = (name: string): void => {
    schema.setSelectedTable(name)
    setView('detail')
  }

  const handleBack = (): void => {
    setView('list')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--cos-border)]">
        <div className="flex items-center gap-2">
          {view === 'detail' && (
            <button
              onClick={handleBack}
              className="text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer text-xs"
            >
              &larr;
            </button>
          )}
          <span className="text-xs font-medium text-[var(--cos-text-primary)]">
            {view === 'detail' && schema.selectedTable ? schema.selectedTable : 'Database'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {devMode.enabled && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded">
              DEV
            </span>
          )}
          <button
            onClick={devMode.toggle}
            className={`px-1.5 py-0.5 text-[10px] rounded cursor-pointer transition-colors ${
              devMode.enabled
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-hover)]'
            }`}
            title={devMode.enabled ? 'Disable Developer Mode' : 'Enable Developer Mode'}
          >
            {devMode.enabled ? 'DEV ON' : 'DEV'}
          </button>
          <button
            onClick={schema.refresh}
            className="text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer text-xs px-1"
            title="Refresh"
          >
            &#x21bb;
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'list' ? (
          <TableList
            tables={schema.tables}
            selectedTable={schema.selectedTable}
            onSelectTable={handleSelectTable}
            loading={schema.loading}
          />
        ) : (
          <TableDetail
            table={schema.selectedTable!}
            columns={schema.columns}
            primaryKey={schema.primaryKey}
            indexes={schema.indexes}
          />
        )}
      </div>
    </div>
  )
}
