import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { FleetReport } from '../lib/api'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export default function Reports() {
  const [reports, setReports] = useState<FleetReport[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected] = useState<FleetReport | null>(null)

  async function load() {
    const list = await api.listReports()
    setReports(list)
    setLoading(false)
    // Auto-select latest
    if (list.length > 0 && !selected) setSelected(list[0])
  }

  useEffect(() => {
    load()
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const report = await api.generateReport()
      setSelected(report)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-white">Fleet Reports</h1>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {generating ? 'Generating...' : 'Generate Now'}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading...</p>
      ) : reports.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No reports yet. Click "Generate Now" to create the first one.
        </p>
      ) : (
        <div className="flex gap-6">
          {/* Report list */}
          <div className="w-56 flex-shrink-0 space-y-1">
            {reports.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors ${
                  selected?.id === r.id
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <div>{new Date(r.generatedAt).toLocaleDateString()}</div>
                <div className="text-gray-600 mt-0.5">{timeAgo(r.generatedAt)}</div>
              </button>
            ))}
          </div>

          {/* Report content */}
          <div className="flex-1 min-w-0">
            {selected ? (
              <div className="border border-gray-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-gray-500">
                    {new Date(selected.generatedAt).toLocaleString()}
                  </span>
                  <span className="text-xs text-gray-600">
                    Period: {new Date(selected.periodStart).toLocaleDateString()} —{' '}
                    {new Date(selected.periodEnd).toLocaleDateString()}
                  </span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-gray-300 whitespace-pre-wrap">
                  {selected.content}
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Select a report to view.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
