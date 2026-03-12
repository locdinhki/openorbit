import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api, type Task, type Device } from '../lib/api'
import { relativeTime } from '../lib/time'
import { useLiveUpdates, type LiveEvent } from '../lib/use-live-updates'
import StatusBadge from '../components/StatusBadge'

const STATUSES = ['', 'queued', 'dispatched', 'running', 'completed', 'failed', 'timeout']

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [deviceFilter, setDeviceFilter] = useState('')

  useEffect(() => {
    api
      .listDevices()
      .then(setDevices)
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
  }, [statusFilter, deviceFilter])

  const handleLive = useCallback((evt: LiveEvent) => {
    if (evt.event === 'task.created') {
      const p = evt.payload as { task: Task }
      setTasks((prev) => [p.task, ...prev].slice(0, 100))
    } else if (evt.event === 'task.updated') {
      const p = evt.payload as { taskId: string; status: string; completedAt?: string }
      setTasks((prev) =>
        prev.map((t) =>
          t.id === p.taskId
            ? { ...t, status: p.status, completedAt: p.completedAt ?? t.completedAt }
            : t
        )
      )
    }
  }, [])
  useLiveUpdates(handleLive)

  async function load() {
    try {
      const params: Record<string, string | number> = { limit: 100 }
      if (statusFilter) params.status = statusFilter
      if (deviceFilter) params.deviceId = deviceFilter
      setTasks(await api.listTasks(params))
    } catch {
      // handled by api interceptor
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tasks</h1>
        <Link
          to="/tasks/new"
          className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 transition-colors"
        >
          Dispatch Task
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300 focus:outline-none focus:border-gray-600"
        >
          <option value="">All statuses</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          className="px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300 focus:outline-none focus:border-gray-600"
        >
          <option value="">All devices</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-gray-800/50 rounded" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-gray-500">No tasks found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">ID</th>
                <th className="pb-2 pr-4 font-medium">Device</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Priority</th>
                <th className="pb-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const instrType = (t.instruction as Record<string, unknown>).type as string
                return (
                  <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                    <td className="py-2.5 pr-4">
                      <Link
                        to={`/tasks/${t.id}`}
                        className="text-xs font-mono text-blue-400 hover:underline"
                      >
                        {t.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400 text-xs">{t.targetDevice ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-gray-300 text-xs">{instrType}</td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400 text-xs">{t.priority}</td>
                    <td className="py-2.5 text-gray-500 text-xs">{relativeTime(t.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
