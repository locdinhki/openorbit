import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type TaskTemplate, type Device } from '../lib/api'
import { relativeTime } from '../lib/time'

export default function Templates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<string | null>(null)
  const [pickDevice, setPickDevice] = useState<string | null>(null)
  const [selectedDevice, setSelectedDevice] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([api.listTemplates(), api.listDevices()])
      .then(([t, d]) => {
        setTemplates(t)
        setDevices(d)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleRun(tpl: TaskTemplate) {
    if (!tpl.deviceId) {
      setPickDevice(tpl.id)
      return
    }
    setRunning(tpl.id)
    try {
      await api.runTemplate(tpl.id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    } finally {
      setRunning(null)
    }
  }

  async function handleRunWithDevice(tplId: string) {
    if (!selectedDevice) return
    setRunning(tplId)
    setPickDevice(null)
    try {
      await api.runTemplate(tplId, { deviceId: selectedDevice })
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    } finally {
      setRunning(null)
      setSelectedDevice('')
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return
    await api.deleteTemplate(id)
    setTemplates(await api.listTemplates())
  }

  const filtered = search
    ? templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : templates

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Templates</h1>
        <Link
          to="/tasks/new?saveAsTemplate=1"
          className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 transition-colors"
        >
          New Template
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search templates..."
        className="input w-full max-w-xs"
      />

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500">
          {search ? 'No matching templates' : 'No templates saved'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((tpl) => (
            <div key={tpl.id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{tpl.name}</p>
                  {tpl.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-1">
                    {String(tpl.instruction.type)} · {tpl.deviceId || 'any device'} ·{' '}
                    {relativeTime(tpl.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {pickDevice === tpl.id ? (
                    <div className="flex items-center gap-1">
                      <select
                        value={selectedDevice}
                        onChange={(e) => setSelectedDevice(e.target.value)}
                        className="input text-xs py-1"
                      >
                        <option value="">Device...</option>
                        {devices
                          .filter((d) => d.status === 'online')
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => handleRunWithDevice(tpl.id)}
                        disabled={!selectedDevice}
                        className="px-2 py-1 bg-green-700 hover:bg-green-600 text-xs text-white rounded disabled:opacity-50"
                      >
                        Go
                      </button>
                      <button
                        onClick={() => setPickDevice(null)}
                        className="text-xs text-gray-500 hover:text-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRun(tpl)}
                      disabled={running === tpl.id}
                      className="px-2.5 py-1 bg-green-700 hover:bg-green-600 text-xs text-white rounded transition-colors disabled:opacity-50"
                    >
                      {running === tpl.id ? 'Running...' : 'Run'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(tpl.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
