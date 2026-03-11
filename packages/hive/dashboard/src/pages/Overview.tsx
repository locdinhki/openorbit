import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Device, type Task, type HealthResponse } from '../lib/api'
import StatusBadge from '../components/StatusBadge'

export default function Overview() {
  const [devices, setDevices] = useState<Device[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [])

  async function load() {
    try {
      const [d, t, h] = await Promise.all([
        api.listDevices(),
        api.listTasks({ limit: 50 }),
        api.health()
      ])
      setDevices(d)
      setTasks(t)
      setHealth(h)
    } catch {
      // handled by api interceptor
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Skeleton />

  const online = devices.filter((d) => d.status === 'online').length
  const offline = devices.length - online

  // Tasks created in last 24h
  const dayAgo = Date.now() - 86_400_000
  const todayTasks = tasks.filter((t) => new Date(t.createdAt).getTime() > dayAgo)
  const tasksByStatus = todayTasks.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  const uptimeHours = health ? Math.floor(health.uptime / 3600) : 0
  const uptimeMinutes = health ? Math.floor((health.uptime % 3600) / 60) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Fleet Overview</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Devices" value={devices.length} />
        <StatCard label="Online" value={online} accent="text-emerald-400" />
        <StatCard
          label="Offline"
          value={offline}
          accent={offline > 0 ? 'text-gray-400' : undefined}
        />
        <StatCard label="Hive Uptime" value={`${uptimeHours}h ${uptimeMinutes}m`} />
      </div>

      {/* Tasks today */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-300">Tasks (24h)</h2>
          <Link to="/tasks" className="text-xs text-gray-500 hover:text-gray-300">
            View all
          </Link>
        </div>
        {todayTasks.length === 0 ? (
          <p className="text-xs text-gray-600">No tasks in the last 24 hours</p>
        ) : (
          <div className="flex gap-3 flex-wrap">
            {Object.entries(tasksByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="text-xs text-gray-400">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent devices */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-300">Devices</h2>
          <Link to="/devices" className="text-xs text-gray-500 hover:text-gray-300">
            View all
          </Link>
        </div>
        <div className="grid gap-2">
          {devices.map((d) => (
            <Link
              key={d.id}
              to={`/devices/${d.id}`}
              className="flex items-center justify-between p-3 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-emerald-400' : 'bg-gray-600'}`}
                />
                <span className="text-sm text-white">{d.name}</span>
                <span className="text-xs text-gray-500">{d.type}</span>
              </div>
              <StatusBadge status={d.status} />
            </Link>
          ))}
          {devices.length === 0 && <p className="text-xs text-gray-600">No devices registered</p>}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  accent
}: {
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-lg">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-40 bg-gray-800 rounded" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-gray-800/50 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
