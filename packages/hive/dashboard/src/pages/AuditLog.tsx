import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import type { AuditEntry } from '../lib/api'

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  async function load() {
    try {
      const list = await api.listAuditLog({
        action: actionFilter || undefined,
        limit: 200
      })
      setEntries(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [actionFilter])

  const actions = [...new Set(entries.map((e) => e.action))].sort()

  if (loading) return <p className="text-xs text-gray-500">Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-sm font-semibold text-white">Audit Log</h1>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-2 py-1 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300 focus:outline-none"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

      <div className="border border-gray-800 rounded-md overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left px-3 py-2 font-medium">Time</th>
              <th className="text-left px-3 py-2 font-medium">Action</th>
              <th className="text-left px-3 py-2 font-medium">User</th>
              <th className="text-left px-3 py-2 font-medium">Target</th>
              <th className="text-left px-3 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 bg-gray-800 rounded text-[10px] text-gray-300 font-mono">
                    {entry.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-400">{entry.userId ?? '-'}</td>
                <td className="px-3 py-2 text-gray-500 font-mono text-[10px]">
                  {entry.targetId ? entry.targetId.slice(0, 12) : '-'}
                </td>
                <td className="px-3 py-2 text-gray-600 font-mono text-[10px]">
                  {entry.ipAddress ?? '-'}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-600">
                  No audit entries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
