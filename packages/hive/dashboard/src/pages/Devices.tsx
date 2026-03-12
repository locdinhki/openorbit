import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api, type Device, type MinionLatest } from '../lib/api'
import { relativeTime } from '../lib/time'
import { useLiveUpdates, type LiveEvent } from '../lib/use-live-updates'
import StatusBadge from '../components/StatusBadge'

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [latest, setLatest] = useState<MinionLatest | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [updatingAll, setUpdatingAll] = useState(false)

  useEffect(() => {
    load()
  }, [])

  // Live updates — patch device status in place instead of polling
  const handleLive = useCallback((evt: LiveEvent) => {
    if (evt.event === 'device.status') {
      const p = evt.payload as { deviceId: string; status: string; lastSeenAt: string }
      setDevices((prev) =>
        prev.map((d) =>
          d.id === p.deviceId ? { ...d, status: p.status, lastSeenAt: p.lastSeenAt } : d
        )
      )
    }
  }, [])
  useLiveUpdates(handleLive)

  async function load() {
    try {
      const [devs] = await Promise.all([api.listDevices()])
      setDevices(devs)
      // Try to load latest version info (may 404 if not configured)
      api
        .getMinionLatest()
        .then(setLatest)
        .catch(() => setLatest(null))
    } catch {
      // handled by api interceptor
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdate(deviceId: string) {
    setUpdating((prev) => ({ ...prev, [deviceId]: true }))
    try {
      await api.updateMinion(deviceId)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdating((prev) => ({ ...prev, [deviceId]: false }))
    }
  }

  async function handleUpdateAll() {
    if (!confirm(`Update all online minions to v${latest?.version}?`)) return
    setUpdatingAll(true)
    try {
      const result = await api.updateAllMinions()
      alert(`Update dispatched to ${result.deviceCount} device(s)`)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update all failed')
    } finally {
      setUpdatingAll(false)
    }
  }

  const online = devices.filter((d) => d.status === 'online').length
  const outdated = latest
    ? devices.filter((d) => d.status === 'online' && d.minionVersion !== latest.version)
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Devices</h1>
          {latest && (
            <p className="text-xs text-gray-500 mt-0.5">
              Latest: v{latest.version}
              {outdated.length > 0 && (
                <span className="text-amber-400 ml-2">{outdated.length} outdated</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {online} online / {devices.length} total
          </span>
          {latest && outdated.length > 0 && (
            <button
              onClick={handleUpdateAll}
              disabled={updatingAll}
              className="px-3 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-md transition-colors"
            >
              {updatingAll ? 'Dispatching...' : `Update All (${outdated.length})`}
            </button>
          )}
        </div>
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
                <th className="pb-2 pr-4 font-medium">Version</th>
                <th className="pb-2 pr-4 font-medium">Location</th>
                <th className="pb-2 font-medium">Last Seen</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const hw = d.hardwareInfo as Record<string, unknown> | null
                const hwSummary = hw
                  ? `${hw.platform ?? ''} ${hw.arch ?? ''} / ${(hw.memory as { totalMb?: number } | null)?.totalMb ? Math.round(Number((hw.memory as { totalMb: number }).totalMb) / 1024) + 'GB' : '?'}`
                  : '—'

                const isOutdated = latest && d.minionVersion && d.minionVersion !== latest.version
                const canUpdate = latest && d.status === 'online' && d.type === 'minion'

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
                    <td className="py-2.5 pr-4 text-xs">
                      {d.minionVersion ? (
                        <span className={isOutdated ? 'text-amber-400' : 'text-gray-400'}>
                          v{d.minionVersion}
                          {isOutdated && (
                            <span className="text-gray-600 ml-1">→ v{latest!.version}</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">{d.locationTag ?? '—'}</td>
                    <td className="py-2.5 pr-4 text-gray-500 text-xs">
                      {relativeTime(d.lastSeenAt)}
                    </td>
                    <td className="py-2.5 text-right">
                      {canUpdate && isOutdated && (
                        <button
                          onClick={() => handleUpdate(d.id)}
                          disabled={updating[d.id]}
                          className="text-xs text-amber-500 hover:text-amber-300 disabled:opacity-50 transition-colors"
                        >
                          {updating[d.id] ? 'Dispatching...' : 'Update'}
                        </button>
                      )}
                    </td>
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
