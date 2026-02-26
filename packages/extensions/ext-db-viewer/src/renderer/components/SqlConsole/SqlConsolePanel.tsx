import { useDevMode } from '../../hooks/useDevMode'
import { useSqlConsole } from '../../hooks/useSqlConsole'

export default function SqlConsolePanel(): React.JSX.Element {
  const devMode = useDevMode()
  const console = useSqlConsole()

  if (devMode.loading) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)] text-xs">
        Loading...
      </div>
    )
  }

  if (!devMode.enabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-xs text-[var(--cos-text-muted)]">
          Enable Developer Mode to use the SQL console
        </p>
        <button
          onClick={devMode.toggle}
          className="px-3 py-1.5 text-xs text-white bg-amber-600 hover:bg-amber-500 rounded cursor-pointer"
        >
          Enable Developer Mode
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* SQL Input */}
      <div className="p-2 border-b border-[var(--cos-border)]">
        <textarea
          value={console.currentSql}
          onChange={(e) => console.setCurrentSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              console.execute()
            }
          }}
          placeholder="Enter SQL query... (Cmd+Enter to execute)"
          rows={4}
          className="w-full bg-[var(--cos-bg-secondary)] text-[var(--cos-text-primary)] border border-[var(--cos-border)] rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-indigo-500 resize-y"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-[var(--cos-text-muted)]">
            {console.isExecuting ? 'Executing...' : 'Cmd+Enter to run'}
          </span>
          <button
            onClick={() => console.execute()}
            disabled={console.isExecuting || !console.currentSql.trim()}
            className="px-2 py-1 text-[10px] text-white bg-indigo-600 hover:bg-indigo-500 rounded cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            Execute
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-2">
        {console.error && (
          <div className="text-xs text-red-400 bg-red-500/10 rounded p-2 mb-2">
            {console.error}
          </div>
        )}

        {console.results && (
          <div>
            <div className="flex items-center gap-2 mb-1 text-[10px] text-[var(--cos-text-muted)]">
              <span>{console.results.statementType}</span>
              {console.results.rowsAffected > 0 && (
                <span>{console.results.rowsAffected} rows affected</span>
              )}
              <span>{console.results.executionTimeMs}ms</span>
            </div>

            {console.results.columns.length > 0 && (
              <div className="overflow-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[var(--cos-bg-secondary)]">
                      {console.results.columns.map((col) => (
                        <th
                          key={col}
                          className="px-2 py-1 text-left font-medium text-[var(--cos-text-muted)] border-b border-[var(--cos-border)] whitespace-nowrap"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {console.results.rows.map((row, i) => (
                      <tr
                        key={i}
                        className={
                          i % 2 === 0
                            ? 'bg-[var(--cos-bg-primary)]'
                            : 'bg-[var(--cos-bg-secondary)]/30'
                        }
                      >
                        {row.map((cell, j) => (
                          <td
                            key={j}
                            className="px-2 py-1 border-b border-[var(--cos-border)]/30 text-[var(--cos-text-secondary)] max-w-[200px] truncate"
                          >
                            {cell === null ? (
                              <span className="italic text-[var(--cos-text-muted)]">NULL</span>
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {console.results.columns.length === 0 && console.results.rowsAffected > 0 && (
              <div className="text-xs text-emerald-400">
                {console.results.rowsAffected} row{console.results.rowsAffected !== 1 ? 's' : ''}{' '}
                affected
              </div>
            )}
          </div>
        )}

        {/* Query History */}
        {console.history.length > 0 && (
          <div className="mt-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--cos-text-muted)] mb-1">
              History
            </h3>
            <div className="space-y-0.5">
              {console.history.map((entry, i) => (
                <button
                  key={i}
                  onClick={() => console.setCurrentSql(entry.sql)}
                  className="w-full text-left px-2 py-1 text-[10px] text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-hover)] rounded cursor-pointer truncate font-mono"
                  title={entry.sql}
                >
                  <span className="text-[var(--cos-text-muted)]">
                    [{entry.statementType}]
                  </span>{' '}
                  {entry.sql}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
