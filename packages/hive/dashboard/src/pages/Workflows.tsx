import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Workflow, type WorkflowRun } from '../lib/api'
import { relativeTime } from '../lib/time'
import StatusBadge from '../components/StatusBadge'

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [runningRuns, setRunningRuns] = useState<Record<string, WorkflowRun | null>>({})
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)

  useEffect(() => {
    api
      .listWorkflows()
      .then(setWorkflows)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleRun(id: string) {
    setTriggering(id)
    try {
      const run = await api.runWorkflow(id)
      setRunningRuns((prev) => ({ ...prev, [id]: run }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to start run')
    } finally {
      setTriggering(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this workflow?')) return
    await api.deleteWorkflow(id)
    setWorkflows(await api.listWorkflows())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Workflows</h1>
        <Link
          to="/workflows/new"
          className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 transition-colors"
        >
          New Workflow
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <p className="text-sm text-gray-500">No workflows defined</p>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => {
            const run = runningRuns[wf.id]
            return (
              <div key={wf.id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{wf.name}</p>
                    {wf.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{wf.description}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">
                      {wf.steps.length} step{wf.steps.length !== 1 ? 's' : ''} ·{' '}
                      {relativeTime(wf.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {run && (
                      <Link
                        to={`/workflow-runs/${run.id}`}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        View run →
                      </Link>
                    )}
                    <button
                      onClick={() => handleRun(wf.id)}
                      disabled={triggering === wf.id}
                      className="px-2.5 py-1 bg-green-700 hover:bg-green-600 text-xs text-white rounded transition-colors disabled:opacity-50"
                    >
                      {triggering === wf.id ? 'Starting…' : 'Run'}
                    </button>
                    <button
                      onClick={() => handleDelete(wf.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Step summary */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {wf.steps.map((step, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 bg-gray-800 rounded px-2 py-1 text-xs text-gray-400"
                    >
                      <span className="text-gray-600">{i + 1}.</span>
                      <span>{step.name}</span>
                      <span className="text-gray-600">·</span>
                      <span className="font-mono text-gray-500">
                        {String(step.instruction.type)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
