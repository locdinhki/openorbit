import { useState } from 'react'
import DbViewerWorkspace from './DbViewerWorkspace'
import SqlConsolePanel from './SqlConsole/SqlConsolePanel'

type Tab = 'data' | 'sql'

export default function DbViewerTabbedWorkspace(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('data')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-[var(--cos-border)] bg-[var(--cos-bg-primary)] shrink-0">
        <button
          onClick={() => setActiveTab('data')}
          className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
            activeTab === 'data'
              ? 'text-[var(--cos-text-primary)] border-b-2 border-indigo-500'
              : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)]'
          }`}
        >
          Data
        </button>
        <button
          onClick={() => setActiveTab('sql')}
          className={`px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
            activeTab === 'sql'
              ? 'text-[var(--cos-text-primary)] border-b-2 border-indigo-500'
              : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)]'
          }`}
        >
          SQL Console
        </button>
      </div>

      {/* Tab content — relative/absolute to guarantee bounded dimensions */}
      <div className="relative flex-1">
        <div className="absolute inset-0">
          {activeTab === 'data' ? <DbViewerWorkspace /> : <SqlConsolePanel />}
        </div>
      </div>
    </div>
  )
}
