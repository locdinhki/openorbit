import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Device } from '../lib/api'
import { relativeTime } from '../lib/time'
import StatusBadge from '../components/StatusBadge'

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
    const interval = setInterval(load, 10_000)
    return () => clearInterval(interval)
  }, [])

  async function load() {
    try {
      setDevices(await api.listDevices())
    } catch {
      // handled by api interceptor
    } finally {
      setLoading(false)
    }
  }

  const online = devices.filter((d) => d.status === 'online').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Devices</h1>
        <span className="text-xs text-gray-500">
          {online} online / {devices.length} total
        </span>
      </div>

      {loading ? (
        <TableSkeleton />
      ) : devices.length === 0 ? (
        <p className="text-sm text-gray-500">No devices registered</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">Name</th>
                <th className="pb-2 pr-4 font-medium">Status</th>
                <th className="pb-2 pr-4 font-medium">Type</th>
                <th className="pb-2 pr-4 font-medium">Hardware</th>
                <th className="pb-2 pr-4 font-medium">Location</th>
                <th className="pb-2 font-medium">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const hw = d.hardwareInfo as Record<string, unknown> | null
                const hwSummary = hw
                  ? `${hw.platform ?? ''} ${hw.arch ?? ''} / ${hw.totalMemory ? Math.round(Number(hw.totalMemory) / 1073741824) + 'GB' : '?'}`
                  : '—'

                return (
                  <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                    <td className="py-2.5 pr-4">
                      <Link to={`/devices/${d.id}`} className="text-white hover:underline">
                        {d.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">{d.type}</td>
                    <td className="py-2.5 pr-4 text-gray-400 text-xs">{hwSummary}</td>
                    <td className="py-2.5 pr-4 text-gray-400">{d.locationTag ?? '—'}</td>
                    <td className="py-2.5 text-gray-500 text-xs">{relativeTime(d.lastSeenAt)}</td>
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

function TableSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-10 bg-gray-800/50 rounded" />
      ))}
    </div>
  )
}
