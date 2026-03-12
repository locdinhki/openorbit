import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Device, HealthCheck, HealthCheckResult } from '../lib/api'

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export default function HealthChecks() {
  const [checks, setChecks] = useState<HealthCheck[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [results, setResults] = useState<HealthCheckResult[]>([])
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [formDeviceId, setFormDeviceId] = useState('')
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<'http' | 'command'>('http')
  const [formUrl, setFormUrl] = useState('')
  const [formCommand, setFormCommand] = useState('')
  const [formRunFrom, setFormRunFrom] = useState<'hive' | 'device'>('device')
  const [formInterval, setFormInterval] = useState(60)

  async function load() {
    const [c, d] = await Promise.all([api.listHealthChecks(), api.listDevices()])
    setChecks(c)
    setDevices(d)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  async function handleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null)
      return
    }
    setExpanded(id)
    const r = await api.getHealthCheckResults(id)
    setResults(r)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this health check?')) return
    await api.deleteHealthCheck(id)
    await load()
  }

  async function handleToggle(id: string, enabled: boolean) {
    await api.updateHealthCheck(id, { enabled: !enabled })
    await load()
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    await api.createHealthCheck({
      deviceId: formDeviceId,
      name: formName,
      type: formType,
      url: formType === 'http' ? formUrl : undefined,
      command: formType === 'command' ? formCommand : undefined,
      runFrom: formRunFrom,
      intervalS: formInterval
    })
    setShowForm(false)
    setFormName('')
    setFormUrl('')
    setFormCommand('')
    await load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">Health Checks</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 transition-colors"
        >
          {showForm ? 'Cancel' : 'New Check'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-4 border border-gray-800 rounded-lg space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Device</label>
              <select
                value={formDeviceId}
                onChange={(e) => setFormDeviceId(e.target.value)}
                required
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300"
              >
                <option value="">Select device</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. nginx-health"
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as 'http' | 'command')}
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300"
              >
                <option value="http">HTTP</option>
                <option value="command">Command</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Run From</label>
              <select
                value={formRunFrom}
                onChange={(e) => setFormRunFrom(e.target.value as 'hive' | 'device')}
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300"
              >
                <option value="device">Device</option>
                <option value="hive">Hive</option>
              </select>
            </div>
          </div>
          {formType === 'http' ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL</label>
              <input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                required
                placeholder="http://localhost:80/health"
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Command</label>
              <input
                value={formCommand}
                onChange={(e) => setFormCommand(e.target.value)}
                required
                placeholder="systemctl is-active nginx"
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Interval (seconds)</label>
              <input
                type="number"
                value={formInterval}
                onChange={(e) => setFormInterval(parseInt(e.target.value, 10))}
                min={10}
                className="w-24 px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-gray-300"
              />
            </div>
            <button
              type="submit"
              className="mt-4 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded-md transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : checks.length === 0 ? (
        <p className="text-gray-500 text-sm">No health checks configured.</p>
      ) : (
        <div className="border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Status</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Name</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Device</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Type</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">Run From</th>
                <th className="py-2 px-4 text-left text-xs text-gray-500 font-medium">
                  Last Check
                </th>
                <th className="py-2 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => {
                const device = devices.find((d) => d.id === c.deviceId)
                const isExpanded = expanded === c.id
                return (
                  <>
                    <tr
                      key={c.id}
                      className="border-b border-gray-800/50 hover:bg-gray-900/30 cursor-pointer"
                      onClick={() => handleExpand(c.id)}
                    >
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            !c.enabled
                              ? 'bg-gray-600'
                              : c.lastStatus === 'pass'
                                ? 'bg-green-400'
                                : c.lastStatus === 'fail'
                                  ? 'bg-red-400'
                                  : 'bg-gray-600'
                          }`}
                        />
                      </td>
                      <td className="py-2.5 px-4 text-white">{c.name}</td>
                      <td className="py-2.5 px-4 text-gray-400">{device?.name ?? c.deviceId}</td>
                      <td className="py-2.5 px-4 text-gray-400 text-xs">{c.type}</td>
                      <td className="py-2.5 px-4 text-gray-400 text-xs">{c.runFrom}</td>
                      <td className="py-2.5 px-4 text-gray-500 text-xs">
                        {timeAgo(c.lastCheckedAt)}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggle(c.id, c.enabled)
                          }}
                          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {c.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(c.id)
                          }}
                          className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${c.id}-detail`} className="border-b border-gray-800/50">
                        <td colSpan={7} className="px-4 py-3 bg-gray-900/50">
                          {results.length === 0 ? (
                            <p className="text-xs text-gray-500">No results yet</p>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500 mb-2">
                                Last {results.length} results
                              </p>
                              {results.map((r) => (
                                <div key={r.id} className="flex items-center gap-3 text-xs">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      r.status === 'pass' ? 'bg-green-400' : 'bg-red-400'
                                    }`}
                                  />
                                  <span className="text-gray-400 tabular-nums">
                                    {new Date(r.checkedAt).toLocaleString()}
                                  </span>
                                  <span className="text-gray-500">{r.durationMs}ms</span>
                                  {r.error && (
                                    <span className="text-red-400 truncate max-w-xs">
                                      {r.error}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
