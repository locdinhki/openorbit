import { useEffect, useState, useCallback } from 'react'
import { api } from '../lib/api'
import type { Alert, AlertRule, Device } from '../lib/api'
import { useLiveUpdates, type LiveEvent } from '../lib/use-live-updates'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

const METRIC_LABELS: Record<string, string> = {
  cpu: 'CPU',
  mem: 'RAM',
  offline: 'Offline'
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)

  async function load() {
    const [a, r, d] = await Promise.all([api.listAlerts(), api.listAlertRules(), api.listDevices()])
    setAlerts(a)
    setRules(r)
    setDevices(d)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleLive = useCallback((evt: LiveEvent) => {
    if (evt.event === 'alert.fired') {
      const p = evt.payload as { alert: Alert }
      setAlerts((prev) => [p.alert, ...prev])
    } else if (evt.event === 'alert.resolved') {
      const p = evt.payload as { alertId: string; resolvedAt: string }
      setAlerts((prev) =>
        prev.map((a) => (a.id === p.alertId ? { ...a, resolvedAt: p.resolvedAt } : a))
      )
    }
  }, [])
  useLiveUpdates(handleLive)

  async function handleResolve(id: string) {
    await api.resolveAlert(id)
    await load()
  }

  const filtered = showResolved ? alerts : alerts.filter((a) => !a.resolvedAt)
  const activeCount = alerts.filter((a) => !a.resolvedAt).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-white">Alerts</h1>
          {activeCount > 0 && <p className="text-xs text-red-400 mt-0.5">{activeCount} active</p>}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
            className="accent-cyan-500"
          />
          Show resolved
        </label>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">{showResolved ? 'No alerts.' : 'No active alerts.'}</p>
      ) : (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Status</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Device</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Rule</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Message</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Triggered</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Resolved</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((alert) => {
                const device = devices.find((d) => d.id === alert.deviceId)
                const rule = rules.find((r) => r.id === alert.ruleId)
                const isActive = !alert.resolvedAt

                return (
                  <tr key={alert.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                    <td className="py-2.5 px-4">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-red-500/20 text-red-400' : 'bg-gray-700/50 text-gray-500'
                        }`}
                      >
                        {isActive ? 'active' : 'resolved'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-white">
                      {device?.name ?? alert.deviceId.slice(0, 12)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400">
                      {rule ? (
                        <>
                          <span className="text-gray-300">{rule.name}</span>
                          <span className="text-gray-600 ml-1">
                            ({METRIC_LABELS[rule.metric] ?? rule.metric})
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-600">{alert.ruleId.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400 max-w-xs truncate">
                      {alert.message ?? '—'}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400 text-xs">
                      {timeAgo(alert.triggeredAt)}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400 text-xs">
                      {alert.resolvedAt ? timeAgo(alert.resolvedAt) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {isActive && (
                        <button
                          onClick={() => handleResolve(alert.id)}
                          className="text-xs text-gray-600 hover:text-cyan-400 transition-colors"
                        >
                          Resolve
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
