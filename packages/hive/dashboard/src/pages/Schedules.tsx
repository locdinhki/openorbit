import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Schedule, type Device } from '../lib/api'
import { relativeTime } from '../lib/time'
import StatusBadge from '../components/StatusBadge'

export default function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.listSchedules(), api.listDevices()])
      .then(([s, d]) => {
        setSchedules(s)
        setDevices(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  async function toggleEnabled(schedule: Schedule) {
    await api.updateSchedule(schedule.id, { enabled: !schedule.enabled })
    setSchedules(await api.listSchedules())
  }

  async function handleDelete(id: string) {
    await api.deleteSchedule(id)
    setSchedules(await api.listSchedules())
  }

  const deviceName = (id: string) => devices.find((d) => d.id === id)?.name ?? id

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Schedules</h1>
        <Link
          to="/schedules/new"
          className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 transition-colors"
        >
          New Schedule
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-gray-800/50 rounded" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <p className="text-sm text-gray-500">No schedules configured</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Device</th>
                <th className="pb-2 pr-4 font-medium">Cron</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Last Run</th>
                <th className="pb-2 pr-4 font-medium">Next Run</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                  <td className="py-2.5 pr-4 text-white">{s.name}</td>
                  <td className="py-2.5 pr-4 text-gray-400 text-xs">{deviceName(s.deviceId)}</td>
                  <td className="py-2.5 pr-4 text-gray-400 text-xs font-mono">
                    {s.cronExpression}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-300 text-xs">
                    {(s.instruction as Record<string, unknown>).type as string}
                  </td>
                  <td className="py-2.5 pr-4">
                    <StatusBadge status={s.enabled ? 'online' : 'offline'} />
                  </td>
                  <td className="py-2.5 pr-4 text-gray-500 text-xs">{relativeTime(s.lastRunAt)}</td>
                  <td className="py-2.5 pr-4 text-gray-500 text-xs">{relativeTime(s.nextRunAt)}</td>
                  <td className="py-2.5 flex gap-2">
                    <button
                      onClick={() => toggleEnabled(s)}
                      className="text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      {s.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
