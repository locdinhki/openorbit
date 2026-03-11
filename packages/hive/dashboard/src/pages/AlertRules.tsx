import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { AlertRule, Device } from '../lib/api'

const METRIC_LABELS: Record<string, string> = {
  cpu: 'CPU',
  mem: 'RAM',
  offline: 'Device Offline'
}

export default function AlertRules() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [metric, setMetric] = useState('cpu')
  const [threshold, setThreshold] = useState('90')

  async function load() {
    const [r, d] = await Promise.all([api.listAlertRules(), api.listDevices()])
    setRules(r)
    setDevices(d)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.createAlertRule({
        name,
        deviceId: deviceId || undefined,
        metric,
        threshold: Number(threshold)
      })
      setName('')
      setDeviceId('')
      setMetric('cpu')
      setThreshold('90')
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    await api.deleteAlertRule(id)
    await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">Alert Rules</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-md transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Rule'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="border border-gray-800 rounded-lg p-4 mb-6 bg-gray-900/30"
        >
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rule Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. High CPU alert"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Device (optional)</label>
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-600"
              >
                <option value="">All devices</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Metric</label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-600"
              >
                <option value="cpu">CPU %</option>
                <option value="mem">RAM %</option>
                <option value="offline">Device Offline</option>
              </select>
            </div>
            {metric !== 'offline' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Threshold (%)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-600"
                />
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-md transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Rule'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : rules.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No alert rules yet. Create one to get notified when thresholds are exceeded.
        </p>
      ) : (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Name</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Metric</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Threshold</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Device</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const device = devices.find((d) => d.id === rule.deviceId)
                return (
                  <tr key={rule.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                    <td className="py-2.5 px-4 text-white">{rule.name}</td>
                    <td className="py-2.5 px-4 text-gray-400">
                      {METRIC_LABELS[rule.metric] ?? rule.metric}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400">
                      {rule.metric === 'offline' ? '—' : `> ${rule.threshold}%`}
                    </td>
                    <td className="py-2.5 px-4 text-gray-400">
                      {device ? device.name : <span className="text-gray-600">All devices</span>}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
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
