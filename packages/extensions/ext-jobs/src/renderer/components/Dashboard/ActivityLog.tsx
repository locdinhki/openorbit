import { useEffect, useState } from 'react'
import { ipc } from '../../lib/ipc-client'

interface ActionEntry {
  id: string
  action: string
  detail?: string
  timestamp: string
  status: 'success' | 'error' | 'info'
}

export default function ActivityLog(): React.JSX.Element {
  const [entries, setEntries] = useState<ActionEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEntries(): Promise<void> {
      setLoading(true)
      const result = await ipc.actionLog.list(50)
      if (result.success && result.data) {
        setEntries(result.data as ActionEntry[])
      }
      setLoading(false)
    }
    loadEntries()
  }, [])

  function getStatusDot(status: string): string {
    switch (status) {
      case 'success':
        return 'bg-green-400'
      case 'error':
        return 'bg-red-400'
      default:
        return 'bg-blue-400'
    }
  }

  function formatTime(timestamp: string): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return <div className="p-3 text-xs text-[var(--cos-text-secondary)]">Loading activity...</div>
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider">
        Recent Activity
      </h3>
      {entries.length === 0 ? (
        <p className="text-xs text-[var(--cos-text-secondary)]">No recent activity</p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 text-xs py-1">
              <div
                className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${getStatusDot(entry.status)}`}
              />
              <div className="flex-1 min-w-0">
                <span className="text-[var(--cos-text-primary)]">{entry.action}</span>
                {entry.detail && (
                  <span className="text-[var(--cos-text-secondary)] ml-1">{entry.detail}</span>
                )}
              </div>
              <span className="text-[var(--cos-text-secondary)] shrink-0">
                {formatTime(entry.timestamp)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
